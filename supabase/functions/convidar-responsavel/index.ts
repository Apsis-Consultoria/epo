// Acesso do responsavel da EPO.
// Quem cadastra a EPO informa o e-mail do responsavel; esta funcao cria a conta
// dele e manda um e-mail com um link para ELE MESMO definir a senha. Depois
// disso ele entra sempre com e-mail e senha.
//
// Regras:
// - so admin, gestor ou cliente podem chamar (papel lido em perfis);
// - senha nunca e gerada nem enviada por aqui: quem define e o proprio dono do
//   e-mail, abrindo o link;
// - o link NUNCA volta na resposta, nem em log: vai direto para o e-mail;
// - conta que ja existe recebe link de redefinicao, sem perder nada.
//
// Como o e-mail sai, na ordem:
//   1. Microsoft Graph, com o mesmo app do Azure que ja leva os arquivos para a
//      pasta oficial (precisa da permissao de aplicacao Mail.Send e do segredo
//      AZURE_REMETENTE com a caixa que assina a mensagem);
//   2. se o Graph nao puder enviar, cai no envio do proprio projeto.
// Sem nenhum dos dois, devolve ok:false com o motivo e nada e prometido na tela.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const PROJETO_URL = Deno.env.get("SUPABASE_URL") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function segredo(nomes: string[]) {
  for (const nome of nomes) {
    const valor = (Deno.env.get(nome) || "").trim();
    if (valor) return valor;
  }
  return "";
}

const TENANT = segredo(["AZURE_TENANT_ID", "GRAPH_TENANT_ID"]);
const CLIENT_ID = segredo(["AZURE_CLIENT_ID", "GRAPH_CLIENT_ID"]);
const CLIENT_SECRET = segredo(["AZURE_CLIENT_SECRET", "GRAPH_CLIENT_SECRET"]);
const REMETENTE = segredo(["AZURE_REMETENTE", "GRAPH_REMETENTE"]);
const APP_URL = segredo(["APP_URL"]) || "https://apsis-consultoria.github.io/epo/";

const GRAPH = "https://graph.microsoft.com/v1.0";
const PAPEIS_OK = ["admin", "gestor", "cliente"];

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

// Aceita apenas destino da mesma origem de quem chamou (evita redirect aberto)
function origemValida(origem: string | null) {
  if (!origem) return null;
  try {
    const u = new URL(origem);
    if (u.protocol !== "https:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return null;
    return u.origin;
  } catch (_e) {
    return null;
  }
}

// A pagina onde o responsavel escolhe a senha dele.
function destinoDaSenha(origem: string | null) {
  const base = origemValida(origem);
  if (base) {
    // mantem a pasta do app quando ele nao esta na raiz do dominio
    try {
      const caminho = new URL(APP_URL).pathname.replace(/[^/]*$/, "");
      return base + (base.indexOf("localhost") >= 0 ? "/" : caminho) + "definir-senha.html";
    } catch (_e) {
      return base + "/definir-senha.html";
    }
  }
  return APP_URL.replace(/[^/]*$/, "") + "definir-senha.html";
}

function escapar(t: string) {
  return String(t == null ? "" : t)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
    throw new Error("credenciais recusadas pela Microsoft: " + (j.error_description || j.error || r.status));
  }
  return j.access_token as string;
}

function corpoDoEmail(link: string, contexto: string, novaConta: boolean) {
  const titulo = novaConta
    ? "Seu acesso ao Auditoria EPOs"
    : "Redefinir a senha do Auditoria EPOs";
  const abertura = novaConta
    ? "A APSIS criou o seu acesso ao sistema de Auditoria de EPOs."
    : "Recebemos um pedido para você definir uma nova senha no sistema de Auditoria de EPOs.";
  const linha = contexto
    ? '<p style="margin:0 0 14px;font-size:14px;color:#4b5563;">Referente a: <b>' + escapar(contexto) + "</b></p>"
    : "";

  return "<!doctype html><html><body style=\"margin:0;background:#f4f6f5;\">" +
    '<div style="max-width:560px;margin:0 auto;padding:28px 22px;font-family:Segoe UI,Arial,sans-serif;">' +
      '<div style="background:#ffffff;border-radius:14px;padding:28px 26px;border:1px solid #e5e7eb;">' +
        '<p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#9ca3af;">APSIS Consultoria</p>' +
        '<h1 style="margin:0 0 16px;font-size:20px;color:#1a4731;">' + titulo + "</h1>" +
        '<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#374151;">' + abertura + "</p>" +
        linha +
        '<p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#374151;">' +
          "Clique no botão abaixo para <b>definir a sua senha</b>. Depois disso você entra no sistema " +
          "sempre com o seu e-mail e essa senha." +
        "</p>" +
        '<p style="margin:0 0 24px;">' +
          '<a href="' + link + '" style="display:inline-block;background:#1a4731;color:#ffffff;' +
          'text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:10px;">' +
          "Definir minha senha</a>" +
        "</p>" +
        '<p style="margin:0 0 6px;font-size:12.5px;line-height:1.6;color:#6b7280;">' +
          "O link é pessoal e tem validade. Se ele expirar, peça um novo para o seu contato na APSIS." +
        "</p>" +
        '<p style="margin:0;font-size:12.5px;line-height:1.6;color:#6b7280;">' +
          "Se você não esperava este e-mail, ignore esta mensagem." +
        "</p>" +
      "</div>" +
      '<p style="margin:16px 0 0;text-align:center;font-size:11.5px;color:#9ca3af;">' +
        "Mensagem automática do sistema de Auditoria de EPOs." +
      "</p>" +
    "</div></body></html>";
}

// Envio pelo Microsoft Graph, com a mesma credencial que leva os arquivos para
// a pasta oficial. Precisa de Mail.Send de aplicacao e de uma caixa remetente.
async function enviarPeloGraph(para: string, assunto: string, html: string) {
  if (!TENANT || !CLIENT_ID || !CLIENT_SECRET) {
    return { ok: false, motivo: "credenciais do Azure nao configuradas" };
  }
  if (!REMETENTE) {
    return { ok: false, motivo: "falta o segredo AZURE_REMETENTE com a caixa que envia" };
  }
  try {
    const token = await tokenAzure();
    const r = await fetch(GRAPH + "/users/" + encodeURIComponent(REMETENTE) + "/sendMail", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: assunto,
          body: { contentType: "HTML", content: html },
          toRecipients: [{ emailAddress: { address: para } }]
        },
        saveToSentItems: false
      })
    });
    if (r.status === 202) return { ok: true, motivo: "enviado pelo Microsoft Graph" };
    const texto = await r.text();
    let detalhe = texto.slice(0, 200);
    try {
      const j = JSON.parse(texto);
      detalhe = (j.error && j.error.message) || detalhe;
    } catch (_e) { /* deixa o texto cru */ }
    if (r.status === 403) {
      detalhe += " | o app do Azure precisa da permissao de aplicacao Mail.Send com consentimento do administrador";
    }
    return { ok: false, motivo: "Graph sendMail " + r.status + ": " + detalhe };
  } catch (e) {
    return { ok: false, motivo: String((e as Error).message || e) };
  }
}

// ------------------------------------------------------------------ handler
Deno.serve(async (req: Request) => {
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

  const admin = createClient(PROJETO_URL, SERVICE, { auth: { persistSession: false } });

  const { data: perfil } = await admin
    .from("perfis").select("papel").eq("user_id", usuario.user.id).maybeSingle();
  const papel = (perfil && (perfil as Record<string, string>).papel) || "";
  if (PAPEIS_OK.indexOf(papel) < 0) {
    return json({ ok: false, motivo: "seu papel (" + (papel || "sem perfil") + ") nao pode dar acesso a responsavel" }, 403);
  }

  let corpo: Record<string, string> = {};
  try { corpo = await req.json(); } catch (_e) { corpo = {}; }

  let email = String(corpo.email || "").trim().toLowerCase();
  let contexto = "";
  const alocacaoId = String(corpo.alocacao_id || "").trim();

  if (alocacaoId) {
    const { data: linha, error } = await admin
      .from("alocacoes")
      .select("id, responsavel_email, epos(nome), processos(nome)")
      .eq("id", alocacaoId).maybeSingle();
    if (error) return json({ ok: false, motivo: "falha ao ler o relatorio pedido: " + error.message }, 400);
    if (!linha) return json({ ok: false, motivo: "relatorio pedido nao encontrado" }, 404);
    const l = linha as Record<string, any>;
    email = String(l.responsavel_email || "").trim().toLowerCase();
    const epo = l.epos ? l.epos.nome : "";
    const proc = l.processos ? l.processos.nome : "";
    contexto = [epo, proc].filter(Boolean).join(" - ");
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ ok: false, motivo: "e-mail invalido" }, 400);

  // Conta ja existe? Decide entre convite e redefinicao, sem apagar nada.
  let existente: { id: string } | null = null;
  try {
    let pagina = 1;
    while (pagina <= 20 && !existente) {
      const { data: lista, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
      if (error) break;
      const achou = (lista && lista.users || []).find(function (u: Record<string, any>) {
        return String(u.email || "").toLowerCase() === email;
      });
      if (achou) existente = { id: (achou as Record<string, any>).id };
      if (!lista || !lista.users || lista.users.length < 200) break;
      pagina += 1;
    }
  } catch (_e) { existente = null; }

  const destino = destinoDaSenha(req.headers.get("Origin"));
  const novaConta = !existente;

  if (novaConta) {
    // Conta criada sem senha: quem define e o proprio dono do e-mail.
    const criada = await admin.auth.admin.createUser({
      email: email,
      email_confirm: true,
      user_metadata: { papel_pretendido: "responsavel", contexto: contexto }
    });
    if (criada.error && !/already|registered|exists/i.test(String(criada.error.message || ""))) {
      return json({ ok: false, motivo: "nao foi possivel criar o acesso: " + criada.error.message }, 502);
    }
    if (criada.data && criada.data.user) existente = { id: criada.data.user.id };
  }

  // Link de uso unico para definir a senha. Nao volta na resposta.
  const tipo = novaConta ? "invite" : "recovery";
  const gerado = await admin.auth.admin.generateLink({
    type: tipo as "invite" | "recovery",
    email: email,
    options: { redirectTo: destino }
  });
  if (gerado.error || !gerado.data || !gerado.data.properties) {
    return json({
      ok: false,
      motivo: "nao foi possivel gerar o link de acesso: " +
        String((gerado.error && gerado.error.message) || "erro desconhecido")
    }, 502);
  }
  const link = (gerado.data.properties as Record<string, string>).action_link;

  const assunto = novaConta
    ? "Seu acesso ao Auditoria EPOs" + (contexto ? " - " + contexto : "")
    : "Definir nova senha - Auditoria EPOs";
  const html = corpoDoEmail(link, contexto, novaConta);

  // 1) Microsoft Graph, com a credencial que ja existe
  let envio = await enviarPeloGraph(email, assunto, html);

  // 2) sem Graph, tenta o envio do proprio projeto
  if (!envio.ok) {
    console.warn("envio pelo Graph falhou:", envio.motivo);
    const pelaPlataforma = novaConta
      ? await admin.auth.admin.inviteUserByEmail(email, { redirectTo: destino })
      : await comoUsuario.auth.resetPasswordForEmail(email, { redirectTo: destino });
    if (!pelaPlataforma.error) {
      envio = { ok: true, motivo: "enviado pelo servico de e-mail do projeto" };
    } else {
      envio = {
        ok: false,
        motivo: "nao foi possivel enviar o e-mail. Graph: " + envio.motivo +
          " | plataforma: " + String(pelaPlataforma.error.message || "")
      };
    }
  }

  // Marca que a senha ainda nao foi definida por ele, para a tela cobrar.
  if (envio.ok && existente) {
    await admin.from("perfis")
      .update({ senha_provisoria: true })
      .eq("user_id", existente.id);
  }

  if (envio.ok && alocacaoId) {
    await admin.from("alocacoes")
      .update({ convite_enviado_em: new Date().toISOString() })
      .eq("id", alocacaoId);
  }

  return json({
    ok: envio.ok,
    email: email,
    contexto: contexto,
    nova_conta: novaConta,
    motivo: envio.motivo
  }, envio.ok ? 200 : 502);
});
