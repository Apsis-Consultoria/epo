// Convite do responsavel da EPO.
// Quem cria a EPO decide os relatorios e o e-mail do responsavel; esta funcao
// avisa esse responsavel por e-mail para ele entrar e anexar os documentos.
//
// Regras:
// - so admin, gestor ou cliente podem chamar (papel lido em perfis);
// - conta nova  -> convite oficial do Supabase (inviteUserByEmail);
// - conta ja existente -> e-mail com codigo/link de acesso (signInWithOtp);
// - o link NUNCA volta na resposta: o e-mail vai direto para o dono do endereco.
// Se o SMTP do projeto ainda nao estiver configurado, devolve ok:false com o
// motivo e a tela oferece copiar o link de acesso manualmente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const PROJETO_URL = Deno.env.get("SUPABASE_URL") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const PAPEIS_OK = ["admin", "gestor", "cliente"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" }
  });
}

// Aceita apenas destino da mesma origem de quem chamou (evita redirect aberto)
function destinoValido(destino: string | undefined, origem: string | null) {
  if (!destino || !origem) return null;
  try {
    const u = new URL(destino);
    if (u.origin !== origem) return null;
    if (!/envio\.html$|index\.html$|\/$/.test(u.pathname)) return null;
    return u.toString();
  } catch (_e) {
    return null;
  }
}

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

  const { data: perfil } = await comoUsuario
    .from("perfis").select("papel").eq("user_id", usuario.user.id).maybeSingle();
  const papel = (perfil && perfil.papel) || "";
  if (PAPEIS_OK.indexOf(papel) < 0) {
    return json({ ok: false, motivo: "seu papel (" + (papel || "sem perfil") + ") nao pode convidar responsavel" }, 403);
  }

  let corpo: Record<string, string> = {};
  try {
    corpo = await req.json();
  } catch (_e) {
    corpo = {};
  }

  const admin = createClient(PROJETO_URL, SERVICE, { auth: { persistSession: false } });

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
    email = String(linha.responsavel_email || "").trim().toLowerCase();
    const epo = (linha as any).epos ? (linha as any).epos.nome : "";
    const proc = (linha as any).processos ? (linha as any).processos.nome : "";
    contexto = [epo, proc].filter(Boolean).join(" - ");
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ ok: false, motivo: "e-mail invalido" }, 400);

  const origem = req.headers.get("Origin");
  const destino = destinoValido(corpo.redirect_to, origem) || undefined;

  // 1) conta nova: convite oficial
  const convite = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: destino,
    data: { papel_pretendido: "responsavel", contexto: contexto }
  });

  let enviado = !convite.error;
  let motivo = enviado ? "convite enviado" : String(convite.error && convite.error.message || "");
  let jaTinhaConta = /already|registered|exists/i.test(motivo);

  // 2) conta existente: e-mail com codigo de acesso
  if (!enviado && jaTinhaConta) {
    const otp = await comoUsuario.auth.signInWithOtp({
      email: email,
      options: { shouldCreateUser: false, emailRedirectTo: destino }
    });
    enviado = !otp.error;
    motivo = enviado
      ? "responsavel ja tinha conta - enviamos um novo codigo de acesso"
      : "nao foi possivel enviar o e-mail: " + String(otp.error && otp.error.message || "erro desconhecido");
  }

  if (enviado && alocacaoId) {
    await admin.from("alocacoes")
      .update({ convite_enviado_em: new Date().toISOString() })
      .eq("id", alocacaoId);
  }

  return json({ ok: enviado, email: email, contexto: contexto, motivo: motivo }, enviado ? 200 : 502);
});
