// "Esqueci a minha senha", do comeco ao fim pela APSIS.
//
// O pedido saia pelo servico de e-mail da plataforma: chegava com o nome dela
// no remetente e no corpo, e o link nascia num formato que a pagina de definir
// senha nem sempre conseguia trocar por sessao - pedido novo matava o link
// anterior, e abrir em outro navegador falhava. Aqui o link e gerado pela
// credencial de servico, enviado pelo mesmo caminho e com o mesmo desenho dos
// outros e-mails do sistema, e carrega um codigo que a pagina troca por sessao
// em qualquer navegador.
//
// Regras:
// - quem chama NAO esta logado: esta funcao e publica por natureza;
// - a resposta e a mesma para e-mail cadastrado e nao cadastrado, senao este
//   endereco viraria um jeito de descobrir quem tem conta;
// - um pedido por minuto por endereco, gravado em tabela propria;
// - o link NUNCA volta na resposta nem em log: vai direto para o e-mail;
// - sem envio de reserva pela plataforma: o e-mail dela e justamente o que
//   nao pode chegar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { montarEmail, saudacaoDe, escapar, VERDE } from "../_shared/email-apsis.ts";
import { enviarPeloGraph } from "../_shared/enviar-email.ts";

const PROJETO_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const APP_URL = (Deno.env.get("APP_URL") || "https://apsis-consultoria.github.io/epo/").trim();

const ESPERA_SEGUNDOS = 60;

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

function paginaDaSenha(origem: string | null) {
  const base = origemValida(origem);
  if (base) {
    try {
      const caminho = new URL(APP_URL).pathname.replace(/[^/]*$/, "");
      return base + (base.indexOf("localhost") >= 0 ? "/" : caminho) + "definir-senha.html";
    } catch (_e) {
      return base + "/definir-senha.html";
    }
  }
  return APP_URL.replace(/[^/]*$/, "") + "definir-senha.html";
}

function corpoDoEmail(nome: string, email: string, link: string) {
  return montarEmail({
    titulo: "Nova senha da Auditoria de EPOs",
    subtitulo: "Auditoria de unidades EPO · Apsis Consultoria",
    saudacao: saudacaoDe(nome),
    paragrafos: [
      "Recebemos um pedido para você definir uma nova senha no sistema de " +
      "<b>Auditoria de EPOs</b> da Apsis Consultoria."
    ],
    quadro: {
      rotulo: "Seus dados de acesso",
      linhas: [
        ["E-mail", '<span style="color:' + VERDE + ';">' + escapar(email) + "</span>"],
        ["Senha", '<span style="color:#6b7280;">você escolhe no botão abaixo</span>']
      ]
    },
    botao: { texto: "Definir nova senha", href: link },
    aviso: "&#128274; <b>Dica de segurança:</b> não compartilhe a sua senha com ninguém. " +
           "O link deste e-mail é pessoal e tem validade; se expirar, peça outro na tela " +
           "de entrada. Se não foi você que pediu, ignore esta mensagem."
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ enviado: false, espere: 0 }, 405);

  let corpo: Record<string, string> = {};
  try { corpo = await req.json(); } catch (_e) { corpo = {}; }
  const email = String(corpo.email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ enviado: false, espere: 0 }, 400);

  const admin = createClient(PROJETO_URL, SERVICE, { auth: { persistSession: false } });

  // O freio vem ANTES de saber se a conta existe: assim ate a demora da
  // resposta e a mesma para os dois casos.
  const { data: ultimo } = await admin.from("pedidos_link_senha")
    .select("pedido_em").eq("email", email).maybeSingle();
  if (ultimo && ultimo.pedido_em) {
    const passados = (Date.now() - new Date(ultimo.pedido_em as string).getTime()) / 1000;
    if (passados < ESPERA_SEGUNDOS) {
      return json({ enviado: false, espere: Math.ceil(ESPERA_SEGUNDOS - passados) });
    }
  }
  await admin.from("pedidos_link_senha")
    .upsert({ email: email, pedido_em: new Date().toISOString() });

  // Conta existe? A resposta ao chamador e a mesma nos dois casos; o que muda
  // e apenas se ha e-mail para mandar.
  let userId = "";
  try {
    let pagina = 1;
    while (pagina <= 20 && !userId) {
      const { data: lista, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
      if (error) break;
      const achou = (lista && lista.users || []).find(function (u: Record<string, unknown>) {
        return String(u.email || "").toLowerCase() === email;
      });
      if (achou) userId = String((achou as Record<string, unknown>).id);
      if (!lista || !lista.users || lista.users.length < 200) break;
      pagina += 1;
    }
  } catch (_e) { userId = ""; }

  if (!userId) return json({ enviado: true, espere: 0 });

  // O codigo (token_hash) vai no endereco da NOSSA pagina, que o troca por
  // sessao na hora do clique. O action_link pronto nao serve: ele consome o
  // codigo no primeiro GET, e leitor de e-mail que abre link para "pre-ver"
  // ja o gastava antes do clique de verdade.
  const gerado = await admin.auth.admin.generateLink({ type: "recovery", email: email });
  const props = gerado.data && (gerado.data.properties as Record<string, string> | undefined);
  const codigo = props ? props.hashed_token : "";
  if (gerado.error || !codigo) {
    console.warn("link de senha nao gerado:", gerado.error && gerado.error.message);
    return json({ enviado: false, espere: 0 }, 502);
  }
  const link = paginaDaSenha(req.headers.get("Origin")) +
    "?codigo=" + encodeURIComponent(codigo);

  let nome = "";
  const { data: perfil } = await admin.from("perfis")
    .select("nome").eq("user_id", userId).maybeSingle();
  if (perfil && perfil.nome) nome = String(perfil.nome);

  const envio = await enviarPeloGraph(email, "Nova senha da Auditoria de EPOs",
                                      corpoDoEmail(nome, email, link));
  if (!envio.ok) {
    console.warn("envio do link de senha falhou:", envio.motivo);
    return json({ enviado: false, espere: 0 }, 502);
  }
  return json({ enviado: true, espere: 0 });
});
