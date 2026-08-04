// Entrada por codigo no e-mail, sem senha.
//
// A Gerencia Claro e o responsavel da EPO nao tem senha neste sistema: informam
// o e-mail na tela de entrada, recebem um codigo de seis digitos e digitam. Nao
// ha senha para criar, guardar, esquecer nem redefinir.
//
// Esta funcao faz a primeira metade: confere se o e-mail tem acesso, gera o
// codigo, guarda SO o resumo criptografico dele e manda o codigo por e-mail com
// o mesmo desenho dos outros avisos do sistema.
//
// Regras:
// - quem chama NAO esta logado: esta funcao e publica por natureza;
// - a resposta e a mesma para e-mail com acesso e sem acesso, senao este
//   endereco viraria um jeito de descobrir quem tem conta;
// - o codigo NUNCA volta na resposta, nem em log, nem em mensagem de erro;
// - um pedido por minuto por e-mail, gravado no proprio registro do codigo;
// - a conta de entrada e criada na hora, se ainda nao existir: sem ela o codigo
//   nao teria como virar sessao no passo seguinte.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { montarEmail, saudacaoDe } from "../_shared/email-apsis.ts";
import { enviarPeloGraph } from "../_shared/enviar-email.ts";

const PROJETO_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const MINUTOS = 10;

// Segredo do Turnstile. Vazio = captcha desligado nesta funcao, e o pedido segue
// valendo apenas pelo freio de um por minuto.
const CAPTCHA_SEGREDO = (Deno.env.get("TURNSTILE_SECRET") || "").trim();

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

// O captcha do servico de autenticacao NAO alcanca esta funcao: o pedido de
// codigo nao passa por la. Sem conferir aqui, o captcha da tela seria enfeite
// neste caminho - bastaria chamar o endereco direto, sem token.
async function captchaValido(token: string, ip: string) {
  if (!CAPTCHA_SEGREDO) return true;
  if (!token) return false;
  try {
    const form = new FormData();
    form.append("secret", CAPTCHA_SEGREDO);
    form.append("response", token);
    if (ip) form.append("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",
                          { method: "POST", body: form });
    const j = await r.json();
    return !!(j && j.success);
  } catch (_e) {
    return false;   // sem resposta do verificador, negar e o lado seguro
  }
}

// Seis digitos de fonte criptografica. Math.random nao serve: e previsivel o
// suficiente para alguem adivinhar a sequencia.
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
  return visivel + "***@" + partes[1];
}

function corpoDoEmail(codigo: string, nome: string) {
  return montarEmail({
    titulo: "Seu código de entrada",
    subtitulo: "Auditoria de unidades EPO · Apsis Consultoria",
    saudacao: saudacaoDe(nome),
    paragrafos: [
      "Use o código abaixo para entrar no sistema de <b>Auditoria de EPOs</b> " +
      "da Apsis Consultoria. Ele vale por " + MINUTOS + " minutos."
    ],
    destaque: { texto: codigo, legenda: "Seu código" },
    aviso: "&#128274; <b>Dica de segurança:</b> este código é só seu e serve uma vez. " +
           "A APSIS nunca vai pedir o seu código por telefone ou por e-mail. " +
           "Se não foi você que pediu, ignore esta mensagem."
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ enviado: false, espere: 0 }, 405);

  let corpo: Record<string, string> = {};
  try { corpo = await req.json(); } catch (_e) { corpo = {}; }
  const email = String(corpo.email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return json({ enviado: false, espere: 0, motivo: "e-mail invalido" }, 400);
  }

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  if (!await captchaValido(String(corpo.captcha || ""), ip)) {
    return json({ enviado: false, espere: 0, captcha: false }, 400);
  }

  const admin = createClient(PROJETO_URL, SERVICE, { auth: { persistSession: false } });

  // Quem tem acesso: liberado na lista de acessos (e ativo), responsavel de
  // alguma unidade (pela lista da unidade ou pelo questionario pedido no nome
  // dele), ou e-mail da propria casa.
  //
  // A resposta e a mesma nos dois casos; o que muda e apenas se ha e-mail para
  // mandar. Ate o tempo de resposta e parecido, porque as consultas correm
  // antes de decidir.
  const { data: liberado } = await admin.from("acessos_autorizados")
    .select("papel, nome, ativo").ilike("email", email).maybeSingle();
  const { data: respUnidade } = await admin.from("epo_responsaveis")
    .select("nome").ilike("email", email).limit(1).maybeSingle();
  const { data: respPedido } = await admin.from("alocacoes")
    .select("id").ilike("responsavel_email", email).limit(1).maybeSingle();

  const daCasa = email.endsWith("@apsis.com.br");
  const temAcesso = (liberado && (liberado as Record<string, unknown>).ativo === true)
                    || !!respUnidade || !!respPedido || daCasa;

  if (!temAcesso) {
    console.warn("codigo de entrada pedido por e-mail sem acesso");
    return json({ enviado: true, espere: 0, para: emailEncoberto(email) });
  }

  const nome = String(
    (liberado && (liberado as Record<string, string>).nome) ||
    (respUnidade && (respUnidade as Record<string, string>).nome) || ""
  );

  // A conta de entrada precisa existir para o codigo virar sessao no passo
  // seguinte. Criada sem senha: nao existe senha neste caminho.
  let userId = "";
  try {
    const { data } = await admin.rpc("conta_por_email", { p_email: email });
    if (data) userId = String(data);
  } catch (_e) { userId = ""; }

  if (!userId) {
    const criada = await admin.auth.admin.createUser({
      email: email,
      email_confirm: true,
      user_metadata: { entrada: "codigo" }
    });
    if (criada.error) {
      console.warn("conta de entrada nao criada:", criada.error.message);
      return json({ enviado: false, espere: 0 }, 502);
    }
  }

  const codigo = gerarCodigo();
  const { data: reg, error: erroReg } = await admin.rpc("codigo_entrada_registrar", {
    p_email: email, p_codigo: codigo, p_minutos: MINUTOS
  });
  if (erroReg) {
    console.warn("codigo nao registrado:", erroReg.message);
    return json({ enviado: false, espere: 0 }, 502);
  }
  const r = (reg || {}) as Record<string, unknown>;
  if (r.ok !== true) {
    // Freio de um por minuto: a tela diz quantos segundos faltam.
    return json({ enviado: false, espere: Number(r.espere || 60), para: emailEncoberto(email) });
  }

  const envio = await enviarPeloGraph(email, "Seu código de entrada - Auditoria de EPOs",
                                      corpoDoEmail(codigo, nome));
  if (!envio.ok) {
    // O codigo fica gravado e ninguem recebeu: apaga, senao a pessoa fica presa
    // num codigo que nao existe em lugar nenhum.
    await admin.from("codigos_entrada").delete().ilike("email", email).is("usado_em", null);
    console.warn("envio do codigo de entrada falhou:", envio.motivo);
    return json({ enviado: false, espere: 0 }, 502);
  }

  return json({ enviado: true, espere: 0, para: emailEncoberto(email), minutos: MINUTOS });
});
