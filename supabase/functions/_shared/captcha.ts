// A conferencia do captcha (Cloudflare Turnstile), escrita uma vez.
//
// Estava copiada em cada funcao publica. Duas copias da mesma regra de seguranca
// e o comeco de duas regras diferentes: uma ganha um ajuste, a outra fica atras,
// e a porta que ninguem lembrou passa a ser a porta aberta.
//
// Por que conferir aqui e nao confiar no captcha da tela: o captcha do servico de
// autenticacao NAO alcanca estas funcoes - o pedido nao passa por la. Sem esta
// conferencia, o desafio da tela seria enfeite, porque bastaria chamar o endereco
// da funcao direto, sem token.
//
// Segredo vazio = captcha desligado, e a funcao segue valendo pelos outros freios
// (um pedido por minuto por endereco, cinco tentativas por codigo). E assim de
// proposito: e o estado em que o sistema entra no ar antes de o Turnstile estar
// cadastrado, e ligar o captcha nao pode exigir publicar funcao nenhuma.
//
// A ORDEM de configuracao importa. Primeiro a chave do site, em
// assets/supabase-config.js (window.CAPTCHA_SITE_KEY): a tela passa a mandar o
// token e o servidor ainda ignora. Depois o segredo TURNSTILE_SECRET nos segredos
// das funcoes: a conferencia passa a valer. Na ordem inversa, o servidor exigiria
// um token que a tela ainda nao manda, e ninguem entraria.
const SEGREDO = (Deno.env.get("TURNSTILE_SECRET") || "").trim();

export function captchaExigido() {
  return !!SEGREDO;
}

// true quando pode seguir. Sem segredo cadastrado, sempre true.
export async function captchaValido(token: string, ip: string) {
  if (!SEGREDO) return true;
  if (!token) return false;
  try {
    const form = new FormData();
    form.append("secret", SEGREDO);
    form.append("response", token);
    if (ip) form.append("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",
                          { method: "POST", body: form });
    const j = await r.json();
    return !!(j && j.success);
  } catch (_e) {
    // Sem resposta do verificador nao se libera: negar e o lado seguro. Se a
    // Cloudflare cair, a entrada para - e melhor do que a porta ficar aberta
    // justamente quando o porteiro sai.
    return false;
  }
}

// O IP de quem chamou, para o Turnstile conferir junto com o token.
export function ipDoPedido(req: Request) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
}
