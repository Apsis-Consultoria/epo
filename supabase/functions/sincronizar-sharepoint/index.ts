// Envia para a pasta oficial os arquivos que ainda nao foram encaminhados
// (sharepoint_status 'pendente' ou 'erro').
//
// Fluxo: token de aplicacao no Azure (client credentials) -> resolve o site e a
// biblioteca -> garante as pastas -> sobe o arquivo baixado do Storage privado
// -> grava url e data na linha correspondente.
//
// Estrutura na pasta de destino:
//   <pasta configurada> / <nome da EPO> / <nome do questionario> / arquivo
//
// Chamada pelo proprio app, com o JWT de quem esta logado:
//   { alocacao_id }   -> comprovacoes enviadas pelo responsavel da EPO
//   { auditoria_id }  -> evidencias da vistoria da APSIS
//   { tudo: true }    -> reenvia tudo que ficou para tras (admin/gestor)
//   { teste: true }   -> so confere credenciais e destino, sem subir nada
// Nos dois primeiros casos quem chama precisa poder ver aquela alocacao ou
// auditoria (a politica do banco decide).
//
// SEGREDOS (Edge Functions > Secrets), os tres unicos obrigatorios:
//   AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
// Atencao no CLIENT_SECRET: e o VALOR do segredo, nao o ID dele (o portal do
// Azure mostra as duas colunas e o valor aparece uma unica vez).
// Tambem sao aceitos os nomes antigos GRAPH_TENANT_ID / GRAPH_CLIENT_ID /
// GRAPH_CLIENT_SECRET, para nao depender de como o segredo foi cadastrado.
// O destino ja vem no codigo com a pasta de teste. Para trocar de pasta sem
// publicar codigo novo: AZURE_SHAREPOINT_HOSTNAME, AZURE_SHAREPOINT_SITE,
// AZURE_SHAREPOINT_BIBLIOTECA, AZURE_SHAREPOINT_PASTA (ou SP_HOSTNAME,
// SP_SITE_PATH, SP_BIBLIOTECA, SP_PASTA_RAIZ).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const PROJETO_URL = Deno.env.get("SUPABASE_URL") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
// Projeto com o formato novo de chave pode nao injetar o nome antigo. Criar o
// cliente com chave vazia lanca excecao, e a plataforma devolve 502 sem log:
// foi o que derrubou toda chamada autenticada. Agora aceita os dois nomes e,
// sem nenhum deles, responde dizendo o que falta.
const NOMES_SERVICE = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY",
  "SB_SECRET_KEY", "SERVICE_ROLE_KEY"
];

// Le o primeiro nome que existir e devolve tambem qual foi, para o modo teste
// poder dizer o que encontrou sem nunca mostrar o valor.
function segredo(nomes: string[]) {
  for (const nome of nomes) {
    const valor = (Deno.env.get(nome) || "").trim();
    if (valor) return { valor: valor, nome: nome };
  }
  return { valor: "", nome: "" };
}

// Credenciais do app registrado no Azure (Entra ID)
const NOMES_TENANT = ["AZURE_TENANT_ID", "GRAPH_TENANT_ID", "SHAREPOINT_TENANT_ID"];
const NOMES_CLIENT = ["AZURE_CLIENT_ID", "GRAPH_CLIENT_ID", "SHAREPOINT_CLIENT_ID"];
const NOMES_SEGREDO = ["AZURE_CLIENT_SECRET", "GRAPH_CLIENT_SECRET", "SHAREPOINT_CLIENT_SECRET"];

const cService = segredo(NOMES_SERVICE);
const SERVICE = cService.valor;

const cTenant = segredo(NOMES_TENANT);
const cClient = segredo(NOMES_CLIENT);
const cSegredo = segredo(NOMES_SEGREDO);

const TENANT = cTenant.valor;
const CLIENT_ID = cClient.valor;
const CLIENT_SECRET = cSegredo.valor;

// Destino. Padrao = pasta indicada em 30/07/2026:
// apsisconsult.sharepoint.com/sites/backoffice_s/PI/Projeto Claro (pasta teste)
const HOSTNAME = segredo(["AZURE_SHAREPOINT_HOSTNAME", "SP_HOSTNAME"]).valor || "apsisconsult.sharepoint.com";
const SITE_PATH = segredo(["AZURE_SHAREPOINT_SITE", "SP_SITE_PATH"]).valor || "/sites/backoffice_s";
const BIBLIOTECA = segredo(["AZURE_SHAREPOINT_BIBLIOTECA", "SP_BIBLIOTECA"]).valor || "PI";
const PASTA_RAIZ = segredo(["AZURE_SHAREPOINT_PASTA", "SP_PASTA_RAIZ"]).valor || "Projeto Claro (pasta teste)";

const BUCKET = "evidencias";
const LIMITE_SIMPLES = 4 * 1024 * 1024;  // acima disso, sessao de upload
const PEDACO = 3276800;                  // 3,125 MB (multiplo de 320 KiB)
const LOTE = 100;                        // teto de arquivos por chamada
const TEMPO_MAX = 100000;                // para antes do limite da plataforma
const GRAPH = "https://graph.microsoft.com/v1.0";
const PENDENTES = ["pendente", "erro"];  // 'erro' volta na proxima tentativa
const PAPEIS_TUDO = ["admin", "gestor"];

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" }
  });
}

function temCredenciais() {
  return !!(TENANT && CLIENT_ID && CLIENT_SECRET);
}

// SharePoint recusa " * : < > ? / \ | e espaco no inicio ou no fim
function nomeSeguro(nome: string) {
  const limpo = String(nome || "arquivo")
    .replace(/["*:<>?/\\|#%]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  return limpo.slice(0, 180);
}

// O caminho no armazenamento leva um prefixo de tempo para nao repetir nome.
// Na pasta oficial isso nao serve para nada: quem abre quer ver o nome do
// arquivo. Conflito de nome o proprio SharePoint resolve renomeando.
function nomeVisivel(nome: string) {
  return String(nome || "").replace(/^\d{10,}-/, "");
}

const TIPOS: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", heic: "image/heic", heif: "image/heif", bmp: "image/bmp",
  pdf: "application/pdf", txt: "text/plain", csv: "text/csv",
  msg: "application/vnd.ms-outlook", eml: "message/rfc822", zip: "application/zip",
  doc: "application/msword", xls: "application/vnd.ms-excel",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
};

// Sem o tipo certo a foto entra na pasta como arquivo generico e nao abre em
// pre-visualizacao. As evidencias da vistoria nao guardam o tipo, entao ele sai
// da extensao.
function tipoDe(nome: string, tipo: string) {
  if (tipo && tipo.indexOf("/") > 0) return tipo;
  const ext = String(nome || "").split(".").pop() || "";
  return TIPOS[ext.toLowerCase()] || "application/octet-stream";
}

// Acesso negado quase sempre e falta de consentimento do administrador no app
// do Azure. Dizer isso junto do erro economiza uma rodada de investigacao.
function comDica(msg: string) {
  if (/AADSTS7000215/i.test(msg)) {
    return msg + " | o segredo cadastrado parece ser o ID do segredo, e nao o " +
      "VALOR dele: no portal do Azure, App registrations > o app > Certificates " +
      "and secrets, copie a coluna Value (ela aparece uma unica vez; se estiver " +
      "oculta, crie um segredo novo)";
  }
  if (/403|accessDenied|Access denied|unauthorized/i.test(msg)) {
    return msg + " | confira se o app do Azure tem permissao DE APLICACAO do " +
      "Microsoft Graph com consentimento do administrador (Sites.Selected " +
      "autorizando este site, ou Sites.ReadWrite.All)";
  }
  return msg;
}

// ------------------------------------------------------------------- Azure
async function tokenAzure() {
  const corpo = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials"
  });
  const r = await fetch("https://login.microsoftonline.com/" + TENANT + "/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: corpo.toString()
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) {
    throw new Error(comDica("credenciais recusadas pela Microsoft: " + (j.error_description || j.error || r.status)));
  }
  return j.access_token as string;
}

async function get(token: string, url: string) {
  const r = await fetch(GRAPH + url, { headers: { Authorization: "Bearer " + token } });
  const j = await r.json();
  if (!r.ok) {
    const detalhe = (j.error && j.error.message) || "";
    throw new Error(comDica("Graph " + url + ": " + r.status + (detalhe ? " " + detalhe : "")));
  }
  return j;
}

async function resolverDestino(token: string) {
  const caminho = SITE_PATH.replace(/^\/+|\/+$/g, "");
  const site = await get(token, "/sites/" + HOSTNAME + ":/" + caminho);

  if (!BIBLIOTECA) {
    const drive = await get(token, "/sites/" + site.id + "/drive");
    return { site: site.displayName || site.name, driveId: drive.id as string, drive: drive.name };
  }

  const drives = await get(token, "/sites/" + site.id + "/drives");
  const alvo = (drives.value || []).find(function (d: Record<string, string>) {
    // a biblioteca pode vir pelo nome de exibicao ou pelo ultimo pedaco da URL
    // (que e o que aparece no link da pasta)
    const fim = String(d.webUrl || "").split("/").pop() || "";
    return d.name === BIBLIOTECA || fim === BIBLIOTECA;
  });
  if (!alvo) {
    const nomes = (drives.value || []).map(function (d: Record<string, string>) { return d.name; }).join(", ");
    throw new Error('biblioteca "' + BIBLIOTECA + '" nao encontrada no site (existem: ' + nomes + ")");
  }
  return { site: site.displayName || site.name, driveId: alvo.id as string, drive: alvo.name };
}

// O upload por caminho falha quando a pasta pai nao existe, entao a arvore de
// pastas e garantida antes.
const cachePasta = new Map<string, string>();

async function criarPasta(token: string, driveId: string, paiId: string, nome: string) {
  const r = await fetch(GRAPH + "/drives/" + driveId + "/items/" + paiId + "/children", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ name: nome, folder: {}, "@microsoft.graph.conflictBehavior": "fail" })
  });
  if (r.status === 409) { await r.text(); return null; }  // ja existe
  const j = await r.json();
  if (!r.ok) {
    const detalhe = (j.error && j.error.message) || r.status;
    throw new Error(comDica('criar pasta "' + nome + '": ' + detalhe));
  }
  return j.id as string;
}

async function garantirPastas(token: string, driveId: string, partes: string[]) {
  let paiId = "root";
  const trilha: string[] = [];
  for (const parte of partes) {
    const nome = nomeSeguro(parte);
    if (!nome) continue;
    trilha.push(nome);
    const chave = driveId + "|" + trilha.join("/");
    const emCache = cachePasta.get(chave);
    if (emCache) { paiId = emCache; continue; }

    let id = await criarPasta(token, driveId, paiId, nome);
    if (!id) {
      const rota = trilha.map(encodeURIComponent).join("/");
      const existente = await get(token, "/drives/" + driveId + "/root:/" + rota);
      id = existente.id as string;
    }
    cachePasta.set(chave, id);
    paiId = id;
  }
  return paiId;
}

async function enviarArquivo(token: string, driveId: string, pastaId: string, nome: string, bytes: Uint8Array, tipo: string) {
  const limpo = nomeSeguro(nomeVisivel(nome)) || "arquivo";
  const alvo = "/drives/" + driveId + "/items/" + pastaId + ":/" + encodeURIComponent(limpo);

  if (bytes.byteLength <= LIMITE_SIMPLES) {
    const r = await fetch(GRAPH + alvo + ":/content?@microsoft.graph.conflictBehavior=rename", {
      method: "PUT",
      headers: { Authorization: "Bearer " + token, "Content-Type": tipo || "application/octet-stream" },
      body: bytes
    });
    const j = await r.json();
    if (!r.ok) throw new Error(comDica("upload: " + ((j.error && j.error.message) || r.status)));
    return j;
  }

  // foto de celular passa facil de 4 MB: sessao de upload em pedacos
  const rs = await fetch(GRAPH + alvo + ":/createUploadSession", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "rename" } })
  });
  const sessao = await rs.json();
  if (!rs.ok || !sessao.uploadUrl) {
    throw new Error(comDica("sessao de upload: " + ((sessao.error && sessao.error.message) || rs.status)));
  }

  const total = bytes.byteLength;
  let inicio = 0;
  let ultimo: Record<string, unknown> = {};
  while (inicio < total) {
    const fim = Math.min(inicio + PEDACO, total);
    const parte = bytes.subarray(inicio, fim);
    const rp = await fetch(sessao.uploadUrl, {
      method: "PUT",
      headers: { "Content-Range": "bytes " + inicio + "-" + (fim - 1) + "/" + total },
      body: parte
    });
    if (rp.status === 200 || rp.status === 201) ultimo = await rp.json();
    else if (rp.status !== 202) {
      const err = await rp.text();
      throw new Error("pedaco " + inicio + ": " + err.slice(0, 180));
    } else {
      await rp.text();
    }
    inicio = fim;
  }
  return ultimo;
}

// ------------------------------------------------------------------ arquivos
type Pendente = {
  tabela: "alocacao_anexos" | "evidencias";
  id: string;
  storage_path: string;
  nome: string;
  tipo: string;
  criado_em: string;
  epo: string;
  processo: string;
  origem: string;
};

type Cliente = ReturnType<typeof createClient>;

async function listarAnexos(admin: Cliente, alocacaoId: string) {
  const base = admin
    .from("alocacao_anexos")
    .select("id, storage_path, nome_arquivo, content_type, criado_em, alocacoes!inner(epos(nome), processos(nome))")
    .in("sharepoint_status", PENDENTES);
  const filtrado = alocacaoId ? base.eq("alocacao_id", alocacaoId) : base;

  const { data, error } = await filtrado.order("criado_em", { ascending: true }).limit(LOTE);
  if (error) throw new Error("falha ao listar os anexos: " + error.message);

  const lista: Pendente[] = [];
  for (const l of (data || []) as Record<string, any>[]) {
    const al = l.alocacoes || {};
    lista.push({
      tabela: "alocacao_anexos",
      id: l.id,
      storage_path: l.storage_path,
      nome: l.nome_arquivo || "arquivo",
      tipo: l.content_type || "",
      criado_em: l.criado_em,
      epo: (al.epos && al.epos.nome) || "EPO",
      processo: (al.processos && al.processos.nome) || "Questionario",
      origem: "Comprovacoes da EPO"
    });
  }
  return lista;
}

async function listarEvidencias(admin: Cliente, auditoriaId: string) {
  // As evidencias apontam para a resposta, nao para a auditoria. Buscar antes as
  // respostas daquela vistoria deixa o filtro no banco, sem varrer o resto.
  let respostas: string[] | null = null;
  if (auditoriaId) {
    const { data: rs, error: erroRs } = await admin
      .from("respostas").select("id").eq("auditoria_id", auditoriaId);
    if (erroRs) throw new Error("falha ao listar as respostas: " + erroRs.message);
    respostas = ((rs || []) as Record<string, string>[]).map(function (r) { return r.id; });
    if (!respostas.length) return [];
  }

  const base = admin
    .from("evidencias")
    .select("id, storage_path, criado_em, respostas!inner(auditoria_id, auditorias!inner(id, epos(nome), processos(nome)))")
    .in("sharepoint_status", PENDENTES);
  const filtrado = respostas ? base.in("resposta_id", respostas) : base;

  const { data, error } = await filtrado.order("criado_em", { ascending: true }).limit(LOTE);
  if (error) throw new Error("falha ao listar as evidencias: " + error.message);

  const lista: Pendente[] = [];
  for (const l of (data || []) as Record<string, any>[]) {
    const aud = (l.respostas && l.respostas.auditorias) || {};
    if (auditoriaId && String(aud.id || "") !== auditoriaId) continue;
    const partes = String(l.storage_path || "").split("/");
    lista.push({
      tabela: "evidencias",
      id: l.id,
      storage_path: l.storage_path,
      nome: partes[partes.length - 1] || "evidencia",
      tipo: "",
      criado_em: l.criado_em,
      epo: (aud.epos && aud.epos.nome) || "EPO",
      processo: (aud.processos && aud.processos.nome) || "Vistoria",
      origem: "Vistoria APSIS"
    });
  }
  return lista;
}

// ------------------------------------------------------------------ handler
// Qualquer excecao daqui para baixo virava 502 sem mensagem, o pior cenario
// para descobrir o que aconteceu. O tratar() abaixo fica dentro de um try.
Deno.serve(async (req: Request) => {
  try {
    return await tratar(req);
  } catch (e) {
    const msg = String((e as Error).message || e);
    console.error("falha nao tratada:", msg);
    return json({ ok: false, motivo: "falha inesperada: " + msg }, 500);
  }
});

async function tratar(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, motivo: "metodo nao suportado" }, 405);

  const autorizacao = req.headers.get("Authorization") || "";
  if (!autorizacao) return json({ ok: false, motivo: "sem sessao" }, 401);

  const comoUsuario = createClient(PROJETO_URL, ANON, {
    global: { headers: { Authorization: autorizacao } },
    auth: { persistSession: false }
  });
  const { data: usuario, error: erroUsuario } = await comoUsuario.auth.getUser();
  if (erroUsuario || !usuario || !usuario.user) return json({ ok: false, motivo: "sessao invalida" }, 401);

  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch (_e) { corpo = {}; }
  const alocacaoId = String(corpo.alocacao_id || "").trim();
  const auditoriaId = String(corpo.auditoria_id || "").trim();
  const teste = corpo.teste === true;
  const tudo = corpo.tudo === true;

  if (!temCredenciais()) {
    return json({
      ok: false,
      configurado: false,
      motivo: "credenciais do Azure ainda nao configuradas",
      faltando: [
        TENANT ? null : NOMES_TENANT.join(" ou "),
        CLIENT_ID ? null : NOMES_CLIENT.join(" ou "),
        CLIENT_SECRET ? null : NOMES_SEGREDO.join(" ou ")
      ].filter(Boolean)
    }, 200);
  }

  if (!SERVICE) {
    return json({
      ok: false,
      configurado: false,
      motivo: "chave de servico do projeto ausente nesta funcao",
      faltando: [NOMES_SERVICE.join(" ou ")]
    }, 200);
  }

  const admin = createClient(PROJETO_URL, SERVICE, { auth: { persistSession: false } });

  // Conferencia de credenciais e destino, sem subir nada. So a equipe que
  // administra ve a configuracao.
  if (teste || tudo) {
    const { data: perfil } = await admin
      .from("perfis").select("papel").eq("user_id", usuario.user.id).maybeSingle();
    const papel = (perfil && (perfil as Record<string, string>).papel) || "";
    if (PAPEIS_TUDO.indexOf(papel) < 0) {
      return json({ ok: false, motivo: "seu papel (" + (papel || "sem perfil") + ") nao pode fazer isso" }, 403);
    }
  }

  if (teste) {
    try {
      const token = await tokenAzure();
      const destino = await resolverDestino(token);
      const pastaId = await garantirPastas(token, destino.driveId, [PASTA_RAIZ]);
      const pasta = await get(token, "/drives/" + destino.driveId + "/items/" + pastaId);
      return json({
        ok: true,
        site: destino.site,
        biblioteca: destino.drive,
        pasta: PASTA_RAIZ,
        pasta_id: pastaId,
        pasta_url: pasta.webUrl || null,
        // so os NOMES dos segredos encontrados, nunca o valor
        segredos: {
          tenant: cTenant.nome, client_id: cClient.nome, secret: cSegredo.nome,
          servico: cService.nome
        }
      });
    } catch (e) {
      return json({ ok: false, motivo: String((e as Error).message || e) });
    }
  }

  if (!alocacaoId && !auditoriaId && !tudo) {
    return json({ ok: false, motivo: "informe alocacao_id, auditoria_id ou tudo" }, 400);
  }

  // quem chama tem que poder ver o registro (o papel de admin/gestor para
  // 'tudo' ja foi conferido acima)
  if (!tudo) {
    if (alocacaoId) {
      const { data } = await comoUsuario.from("alocacoes").select("id").eq("id", alocacaoId).maybeSingle();
      if (!data) return json({ ok: false, motivo: "sem acesso a este registro" }, 403);
    } else {
      const { data } = await comoUsuario.from("auditorias").select("id").eq("id", auditoriaId).maybeSingle();
      if (!data) return json({ ok: false, motivo: "sem acesso a este registro" }, 403);
    }
  }

  let pendentes: Pendente[] = [];
  try {
    if (tudo) {
      pendentes = (await listarAnexos(admin, "")).concat(await listarEvidencias(admin, ""));
    } else if (alocacaoId) {
      pendentes = await listarAnexos(admin, alocacaoId);
    } else {
      pendentes = await listarEvidencias(admin, auditoriaId);
    }
  } catch (e) {
    return json({ ok: false, motivo: String((e as Error).message || e) });
  }

  if (!pendentes.length) return json({ ok: true, enviados: 0, motivo: "nada pendente" });

  let token: string;
  let destino: { site: string; driveId: string; drive: string };
  try {
    token = await tokenAzure();
    destino = await resolverDestino(token);
  } catch (e) {
    return json({ ok: false, motivo: String((e as Error).message || e) });
  }

  const comecou = Date.now();
  let enviados = 0;
  let adiados = 0;
  const falhas: string[] = [];

  for (const p of pendentes) {
    // arquivo que nao couber no tempo continua pendente e sobe na proxima
    // chamada: nada se perde no meio do caminho
    if (Date.now() - comecou > TEMPO_MAX) { adiados += 1; continue; }
    try {
      const baixado = await admin.storage.from(BUCKET).download(p.storage_path);
      if (baixado.error || !baixado.data) throw new Error("arquivo nao encontrado no armazenamento");
      const bytes = new Uint8Array(await baixado.data.arrayBuffer());

      // Estrutura pedida: pasta da EPO, dentro dela a pasta do questionario,
      // e dentro dela as comprovacoes.
      const pastaId = await garantirPastas(token, destino.driveId, [
        PASTA_RAIZ, p.epo, p.processo
      ]);
      const item = await enviarArquivo(
        token, destino.driveId, pastaId, p.nome, bytes, tipoDe(p.nome, p.tipo)
      );
      const url = (item && (item.webUrl as string)) || null;

      await admin.from(p.tabela).update({
        sharepoint_status: "enviado",
        sharepoint_url: url,
        sharepoint_em: new Date().toISOString()
      }).eq("id", p.id);
      enviados += 1;
    } catch (e) {
      const msg = String((e as Error).message || e).slice(0, 300);
      console.error("falha ao encaminhar", p.storage_path, msg);
      falhas.push(nomeVisivel(p.nome) + ": " + msg);
      // fica em 'erro', que a proxima chamada tenta de novo
      await admin.from(p.tabela).update({
        sharepoint_status: "erro",
        sharepoint_em: new Date().toISOString()
      }).eq("id", p.id);
    }
  }

  console.log("encaminhados", enviados, "de", pendentes.length, "falhas", falhas.length, "adiados", adiados);
  return json({
    ok: falhas.length === 0,
    enviados: enviados,
    pendentes: pendentes.length,
    adiados: adiados,
    // se o lote encheu ou o tempo acabou, sobrou coisa para a proxima chamada
    lote_cheio: pendentes.length >= LOTE || adiados > 0,
    falhas: falhas
  });
}
