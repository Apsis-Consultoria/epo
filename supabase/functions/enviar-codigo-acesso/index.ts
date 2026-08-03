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
import { montarEmail, saudacaoDe } from "../_shared/email-apsis.ts";
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

function corpoDoEmail(codigo: string, nome: string) {
  return montarEmail({
    titulo: "Código de acesso",
    subtitulo: "Auditoria de unidades EPO · Apsis Consultoria",
    saudacao: saudacaoDe(nome),
    paragrafos: [
      "Use o código abaixo para concluir a entrada no sistema de " +
      "<b>Auditoria de EPOs</b> da Apsis Consultoria."
    ],
    destaque: { texto: codigo, legenda: "Seu código" },
    aviso: "&#128274; <b>Dica de segurança:</b> o código vale por " + MINUTOS +
           " minutos e serve para uma entrada só. Ninguém da Apsis vai pedir este " +
           "código por telefone, e-mail ou mensagem. Se não foi você que tentou " +
           "entrar, ignore esta mensagem e troque a sua senha."
  });
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

  const nome = String((usuario.user_metadata && usuario.user_metadata.full_name) || "").trim();
  const envio = await enviarPeloGraph(email, "Código de acesso - Auditoria de EPOs",
                                      corpoDoEmail(codigo, nome));
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
