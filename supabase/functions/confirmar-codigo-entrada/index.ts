// Segunda metade da entrada por codigo: confere o que a pessoa digitou e devolve
// uma credencial de uso unico para a tela trocar por sessao.
//
// Por que em duas partes: quem confere o codigo tem de ser o servidor, com a
// credencial de servico - a tela nao pode saber o codigo nem o resumo dele. E
// quem cria a sessao tem de ser a propria tela, no navegador de quem esta
// entrando, senao a sessao nasceria presa a este servidor.
//
// O que volta quando o codigo esta certo e um "hashed_token": serve UMA vez,
// vale poucos minutos, e a tela troca por sessao com verifyOtp. E o mesmo
// mecanismo que o link de definir senha ja usava neste sistema, que funciona em
// qualquer navegador - inclusive um diferente do que pediu o codigo.
//
// Codigo errado, expirado ou tentado cinco vezes: a resposta diz o motivo em
// portugues, sem nunca dizer se o e-mail existe.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { emailNormalizado } from "../_shared/endereco-email.ts";
import { captchaValido, ipDoPedido } from "../_shared/captcha.ts";

const PROJETO_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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

const RECUSA = "Codigo incorreto ou expirado. Peca um codigo novo.";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, motivo: RECUSA }, 405);

  let corpo: Record<string, string> = {};
  try { corpo = await req.json(); } catch (_e) { corpo = {}; }
  const email = emailNormalizado(corpo.email);
  const codigo = String(corpo.codigo || "").replace(/[^0-9]/g, "");
  if (!email || codigo.length < 4) {
    return json({ ok: false, motivo: "Digite o código de seis dígitos que chegou no seu e-mail." }, 400);
  }

  // O captcha vale TAMBEM aqui, e nao so no pedido do codigo.
  //
  // Faltava, e a consequencia nao era adivinhar o codigo - isso o banco ja
  // impede, com cinco tentativas por codigo e o codigo guardado apenas como
  // resumo criptografico. A consequencia era virar o lado: quem soubesse o
  // endereco de alguem podia, no instante em que a pessoa pedisse o codigo,
  // gastar as cinco tentativas com numeros errados. Na quinta o banco apaga o
  // codigo, e a pessoa certa digita o numero certo e ouve que nao ha codigo em
  // aberto. Repetindo isso a cada minuto, o acesso daquela pessoa fica trancado.
  if (!await captchaValido(String(corpo.captcha || ""), ipDoPedido(req))) {
    return json({ ok: false, motivo: "Confirme que você não é um robô e tente de novo.",
                  captcha: false }, 400);
  }

  const admin = createClient(PROJETO_URL, SERVICE, { auth: { persistSession: false } });

  const { data: conferido, error: erroConf } = await admin.rpc("codigo_entrada_conferir", {
    p_email: email, p_codigo: codigo
  });
  if (erroConf) {
    console.warn("conferencia do codigo falhou:", erroConf.message);
    return json({ ok: false, motivo: "Nao foi possivel conferir o codigo agora. Tente de novo." }, 502);
  }
  const c = (conferido || {}) as Record<string, unknown>;
  if (c.ok !== true) {
    return json({ ok: false, motivo: String(c.motivo || RECUSA) });
  }

  // Codigo certo. A credencial de uso unico vem do proprio servico de contas: e
  // ela que a tela troca por sessao, e ninguem alem de quem acabou de acertar o
  // codigo a recebe.
  const gerado = await admin.auth.admin.generateLink({ type: "magiclink", email: email });
  const props = gerado.data && (gerado.data.properties as Record<string, string> | undefined);
  const token = props ? props.hashed_token : "";
  if (gerado.error || !token) {
    console.warn("credencial de entrada nao gerada:", gerado.error && gerado.error.message);
    return json({ ok: false, motivo: "Nao foi possivel abrir a sessao agora. Tente de novo." }, 502);
  }

  return json({ ok: true, credencial: token });
});
