// Segundo fator do login: gera um codigo de seis digitos, guarda apenas o
// resumo criptografico dele no banco e manda o codigo por e-mail.
//
// Por que isto e uma funcao de servidor e nao uma chamada do navegador:
// se a propria tela criasse o codigo, ela saberia o codigo, e o segundo fator
// nao existiria. O navegador so pede "manda um codigo"; quem gera, guarda e
// envia e este codigo aqui, com a credencial de servico.
//
// O codigo NUNCA volta na resposta, nem em log, nem em mensagem de erro.
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

const GRAPH = "https://graph.microsoft.com/v1.0";
const MINUTOS = 10;

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

// Seis digitos de fonte criptografica. Math.random nao serve para isto: e
// previsivel o suficiente para alguem adivinhar a sequencia.
function gerarCodigo() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1000000).padStart(6, "0");
}

// Mostra so o comeco e o dominio, para a tela poder dizer para onde foi sem
// escrever o endereco inteiro.
function emailEncoberto(email: string) {
  const partes = email.split("@");
  if (partes.length !== 2) return "";
  const nome = partes[0];
  const visivel = nome.slice(0, Math.min(2, nome.length));
  return visivel + "*".repeat(Math.max(nome.length - visivel.length, 3)) + "@" + partes[1];
}

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
    throw new Error("credenciais recusadas pela Microsoft: " +
      (j.error_description || j.error || r.status));
  }
  return j.access_token as string;
}

function corpoDoEmail(codigo: string) {
  const digitos = codigo.split("").join(" ");
  return "<!doctype html><html><body style=\"margin:0;background:#f4f6f5;\">" +
    '<div style="max-width:520px;margin:0 auto;padding:28px 22px;font-family:Segoe UI,Arial,sans-serif;">' +
      '<div style="background:#ffffff;border-radius:14px;padding:28px 26px;border:1px solid #e5e7eb;">' +
        '<p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#9ca3af;">APSIS Consultoria</p>' +
        '<h1 style="margin:0 0 16px;font-size:20px;color:#1a4731;">Codigo de acesso</h1>' +
        '<p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#374151;">' +
          "Use o codigo abaixo para concluir a entrada no sistema de Auditoria de EPOs." +
        "</p>" +
        '<p style="margin:0 0 18px;padding:16px 18px;background:#f4f6f5;border:1px solid #e5e7eb;' +
          'border-radius:10px;text-align:center;font-size:30px;font-weight:700;letter-spacing:.28em;' +
          'color:#1a4731;font-family:Consolas,Menlo,monospace;">' + digitos + "</p>" +
        '<p style="margin:0 0 6px;font-size:12.5px;line-height:1.6;color:#6b7280;">' +
          "O codigo vale por " + MINUTOS + " minutos e serve para uma entrada so." +
        "</p>" +
        '<p style="margin:0;font-size:12.5px;line-height:1.6;color:#6b7280;">' +
          "<b>Se nao foi voce que tentou entrar</b>, ignore esta mensagem e troque a sua senha. " +
          "Ninguem da APSIS vai pedir este codigo por telefone, e-mail ou mensagem." +
        "</p>" +
      "</div>" +
      '<p style="margin:16px 0 0;text-align:center;font-size:11.5px;color:#9ca3af;">' +
        "Mensagem automatica do sistema de Auditoria de EPOs." +
      "</p>" +
    "</div></body></html>";
}

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, motivo: "metodo nao suportado" }, 405);

  const autorizacao = req.headers.get("Authorization") || "";
  if (!autorizacao) return json({ ok: false, motivo: "sem sessao" }, 401);

  // O pedido tem que vir de uma sessao de verdade. E dela que saem o usuario
  // e a sessao: nada disso vem do corpo do pedido, senao qualquer um pediria
  // codigo para o e-mail de outra pessoa.
  const comoUsuario = createClient(PROJETO_URL, ANON, {
    global: { headers: { Authorization: autorizacao } },
    auth: { persistSession: false }
  });

  const { data: sessao, error: erroSessao } = await comoUsuario.auth.getUser();
  if (erroSessao || !sessao || !sessao.user) {
    return json({ ok: false, motivo: "sessao invalida" }, 401);
  }
  const usuario = sessao.user;
  const email = String(usuario.email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return json({ ok: false, motivo: "esta conta nao tem e-mail para receber o codigo" }, 400);
  }

  const admin = createClient(PROJETO_URL, SERVICE, { auth: { persistSession: false } });
  const { data: situacao, error: erroSit } = await comoUsuario.rpc("mfa_situacao");
  if (erroSit) {
    return json({ ok: false, motivo: "nao foi possivel conferir a situacao do acesso" }, 502);
  }
  const s = (situacao || {}) as Record<string, boolean>;
  if (!s.ligada) {
    return json({ ok: true, dispensado: true, motivo: "segundo fator desligado" });
  }
  if (s.dispensada) {
    return json({ ok: true, dispensado: true, motivo: "entrada pela conta Microsoft ja e verificada" });
  }
  if (s.confirmada) {
    return json({ ok: true, dispensado: true, motivo: "este acesso ja esta confirmado" });
  }

  const { data: sessaoId, error: erroId } = await comoUsuario.rpc("mfa_sessao_atual");
  if (erroId || !sessaoId) {
    return json({ ok: false, motivo: "sua sessao expirou. Entre de novo" }, 401);
  }

  const codigo = gerarCodigo();
  const { data: registro, error: erroReg } = await admin.rpc("mfa_registrar_desafio", {
    p_sessao: sessaoId,
    p_user: usuario.id,
    p_codigo: codigo,
    p_minutos: MINUTOS
  });
  if (erroReg) {
    return json({ ok: false, motivo: "nao foi possivel preparar o codigo agora" }, 502);
  }
  const reg = (registro || {}) as Record<string, unknown>;
  if (reg.ok === false) {
    return json({ ok: false, motivo: String(reg.motivo || "pedido recusado") }, 429);
  }

  const envio = await enviarPeloGraph(email, "Codigo de acesso - Auditoria de EPOs",
                                      corpoDoEmail(codigo));
  if (!envio.ok) {
    // O desafio fica gravado mas ninguem recebeu o codigo: apaga, senao a
    // pessoa fica presa num codigo que nao existe em lugar nenhum.
    await admin.from("mfa_desafios").delete().eq("sessao_id", sessaoId).is("usado_em", null);
    console.warn("envio do codigo falhou:", envio.motivo);
    return json({
      ok: false,
      motivo: "Nao foi possivel enviar o codigo agora. Tente de novo em alguns instantes."
    }, 502);
  }

  return json({
    ok: true,
    para: emailEncoberto(email),
    validade_minutos: MINUTOS
  });
});
