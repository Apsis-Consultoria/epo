// Acesso por convite.
// Serve para duas pessoas: o responsavel da unidade, cujo e-mail vem no
// relatorio pedido, e quem a APSIS liberou na lista de acessos autorizados
// (gerente da Claro, coordenacao, consultor). Nos dois casos esta funcao cria
// a conta e manda um e-mail com um link para A PROPRIA PESSOA definir a senha.
// Depois disso ela entra sempre com e-mail e senha.
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
import { montarEmail, saudacaoDe, escapar, VERDE } from "../_shared/email-apsis.ts";
import { enviarPeloGraph } from "../_shared/enviar-email.ts";

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
// Quem pode convidar responsavel de unidade. O gerente da Claro entra aqui
// porque e ele quem sabe o contato da unidade.
const PAPEIS_OK = ["admin", "gestor", "cliente"];
// Quem pode convidar alguem da lista de acessos autorizados. O gerente da
// Claro fica fora: liberar acesso ao sistema e decisao da APSIS.
const PAPEIS_OK_ACESSO = ["admin", "gestor"];
// Liberar administracao ou coordenacao e decisao de administrador. O banco ja
// recusa; aqui a recusa vem antes, com o motivo em portugues.
const PAPEIS_SO_DE_ADMIN = ["admin", "gestor"];

// Os mesmos nomes que a tela de acessos mostra: o e-mail nao pode chamar o
// papel de um jeito e o sistema de outro.
const PAPEL_EM_PALAVRAS: Record<string, string> = {
  admin: "Admin Apsis",
  gestor: "Coordenação Apsis",
  auditor: "Equipe de Campo Apsis",
  cliente: "Gerencia Claro",
  responsavel: "Responsável pela EPO"
};

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

// O desenho vem de _shared/email-apsis.ts, o mesmo do e-mail do codigo de
// seguranca: escrito em cada funcao, os dois voltariam a divergir.
//
// Uma diferenca de proposito em relacao ao e-mail do Secure Share: ali o quadro
// traz a senha escrita. Aqui nao ha senha para mostrar - quem escolhe e a
// propria pessoa, no botao. Senha em e-mail fica numa caixa de mensagens para
// sempre.
function corpoDoEmail(link: string, contexto: string, novaConta: boolean,
                      nome: string, email: string) {
  const abertura = novaConta
    ? "Você recebeu acesso ao sistema de <b>Auditoria de EPOs</b> da Apsis Consultoria" +
      (contexto ? " como <b>" + escapar(contexto) + "</b>" : "") + "."
    : "Recebemos um pedido para você definir uma nova senha no sistema de " +
      "<b>Auditoria de EPOs</b> da Apsis Consultoria.";

  return montarEmail({
    titulo: novaConta ? "Acesso à Auditoria de EPOs" : "Nova senha da Auditoria de EPOs",
    subtitulo: "Auditoria de unidades EPO · Apsis Consultoria",
    saudacao: saudacaoDe(nome),
    paragrafos: [abertura],
    quadro: {
      rotulo: "Seus dados de acesso",
      linhas: [
        ["E-mail", '<span style="color:' + VERDE + ';">' + escapar(email) + "</span>"],
        ["Senha", '<span style="color:#6b7280;">você escolhe no botão abaixo</span>']
      ]
    },
    botao: { texto: novaConta ? "Definir minha senha" : "Definir nova senha", href: link },
    aviso: "&#128274; <b>Dica de segurança:</b> não compartilhe a sua senha com ninguém. " +
           "O link deste e-mail é pessoal e tem validade; se expirar, peça outro ao seu " +
           "contato na Apsis."
  });
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
  let papelPretendido = "responsavel";
  // O e-mail cumprimenta pelo nome. Sem nome ele cumprimenta so com "Ola,".
  let nomeDaPessoa = "";
  const alocacaoId = String(corpo.alocacao_id || "").trim();
  const acessoId = String(corpo.acesso_id || "").trim();
  // Responsavel convidado pela LISTA da unidade (uma unidade pode ter mais de
  // um). Aqui vem o e-mail direto, e a unidade so serve para o e-mail dizer de
  // qual unidade se trata.
  const epoId = String(corpo.epo_id || "").trim();

  if (acessoId) {
    if (PAPEIS_OK_ACESSO.indexOf(papel) < 0) {
      return json({
        ok: false,
        motivo: "seu papel (" + (papel || "sem perfil") + ") nao pode liberar acesso ao sistema"
      }, 403);
    }
    const { data: linha, error } = await admin
      .from("acessos_autorizados")
      .select("id, email, nome, papel, ativo")
      .eq("id", acessoId).maybeSingle();
    if (error) return json({ ok: false, motivo: "falha ao ler a liberacao: " + error.message }, 400);
    if (!linha) return json({ ok: false, motivo: "liberacao nao encontrada" }, 404);
    const l = linha as Record<string, any>;
    if (!l.ativo) {
      return json({ ok: false, motivo: "esta liberacao esta desativada. Ative antes de convidar" }, 400);
    }
    email = String(l.email || "").trim().toLowerCase();
    papelPretendido = String(l.papel || "");
    if (PAPEIS_SO_DE_ADMIN.indexOf(papelPretendido) >= 0 && papel !== "admin") {
      return json({ ok: false,
        motivo: "somente um administrador envia acesso de administracao ou coordenacao" }, 403);
    }
    contexto = PAPEL_EM_PALAVRAS[papelPretendido] || papelPretendido;
    nomeDaPessoa = String(l.nome || "");
  }

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

  if (epoId && !alocacaoId && !acessoId) {
    const { data: uni } = await admin.from("epos").select("nome").eq("id", epoId).maybeSingle();
    if (uni && (uni as Record<string, string>).nome) {
      contexto = String((uni as Record<string, string>).nome);
    }
    const { data: quem } = await admin.from("epo_responsaveis")
      .select("nome").eq("epo_id", epoId).ilike("email", email).maybeSingle();
    if (quem && (quem as Record<string, string>).nome) {
      nomeDaPessoa = String((quem as Record<string, string>).nome);
    }
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ ok: false, motivo: "e-mail invalido" }, 400);

  // Conta ja existe? Decide entre convite e redefinicao, sem apagar nada.
  // Consulta direta: paginar a lista inteira lia ate 4000 contas por chamada e
  // parava de achar gente acima disso.
  let existente: { id: string } | null = null;
  try {
    const { data, error } = await admin.rpc("conta_por_email", { p_email: email });
    if (!error && data) existente = { id: String(data) };
  } catch (_e) { existente = null; }

  const destino = destinoDaSenha(req.headers.get("Origin"));
  const novaConta = !existente;

  if (novaConta) {
    // Conta criada sem senha: quem define e o proprio dono do e-mail.
    const criada = await admin.auth.admin.createUser({
      email: email,
      email_confirm: true,
      user_metadata: { papel_pretendido: papelPretendido, contexto: contexto }
    });
    if (criada.error && !/already|registered|exists/i.test(String(criada.error.message || ""))) {
      return json({ ok: false, motivo: "nao foi possivel criar o acesso: " + criada.error.message }, 502);
    }
    if (criada.data && criada.data.user) existente = { id: criada.data.user.id };
  }

  // Link de uso unico para definir a senha. Nao volta na resposta.
  //
  // Sempre "recovery", nunca "invite". O tipo invite serve para e-mail que
  // ainda NAO tem conta: ele mesmo cria. Como a conta acabou de ser criada
  // acima, pedir invite recebia 422 "A user with this email address has
  // already been registered", a funcao devolvia 502 e nenhum e-mail saia -
  // ou seja, todo primeiro acesso falhava, sempre.
  const gerado = await admin.auth.admin.generateLink({
    type: "recovery",
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
    ? "Seu acesso à Auditoria de EPOs" + (contexto ? " - " + contexto : "")
    : "Nova senha da Auditoria de EPOs";
  const html = corpoDoEmail(link, contexto, novaConta, nomeDaPessoa, email);

  // 1) Microsoft Graph, com a credencial que ja existe
  let envio = await enviarPeloGraph(email, assunto, html);

  // 2) sem Graph, tenta o envio do proprio projeto
  if (!envio.ok) {
    console.warn("envio pelo Graph falhou:", envio.motivo);
    // Aqui vale a mesma regra do link: a conta ja existe neste ponto, entao
    // convidar recusaria com "already registered". Redefinir senha serve para
    // os dois casos, porque conta nova nasce sem senha.
    const pelaPlataforma = await comoUsuario.auth.resetPasswordForEmail(
      email, { redirectTo: destino });
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

  // Marca que a senha ainda nao foi definida por ele, para a tela cobrar - mas
  // SO para quem nunca definiu.
  //
  // Antes marcava sempre. Quem ja tinha senha e recebia um reenvio (ou tinha a
  // unidade dele editada, porque salvar a unidade reenvia o acesso) voltava a
  // ser tratado como primeiro acesso: entrava com a senha certa e a tela o
  // jogava para "defina a sua senha", toda vez, sem dizer por que. Foi assim
  // que um responsavel ficou com senha_trocada_em preenchido e a marca de
  // provisoria de volta em true.
  if (envio.ok && existente) {
    await admin.from("perfis")
      .update({ senha_provisoria: true })
      .eq("user_id", existente.id)
      .is("senha_trocada_em", null);
  }

  if (envio.ok && alocacaoId) {
    await admin.from("alocacoes")
      .update({ convite_enviado_em: new Date().toISOString() })
      .eq("id", alocacaoId);
  }

  if (envio.ok && acessoId) {
    await admin.from("acessos_autorizados")
      .update({ convidado_em: new Date().toISOString() })
      .eq("id", acessoId);
  }

  return json({
    ok: envio.ok,
    email: email,
    contexto: contexto,
    papel: papelPretendido,
    nova_conta: novaConta,
    motivo: envio.motivo
  }, envio.ok ? 200 : 502);
});
