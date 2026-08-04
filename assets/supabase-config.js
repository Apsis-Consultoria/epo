/* Configuração pública do Supabase (Auditoria de EPOs).
   A chave "publishable" é pública por design - a segurança real está no RLS. */
window.SUPABASE_URL = "https://vpkxoyfbxgnizymaurek.supabase.co";
window.SUPABASE_KEY = "sb_publishable_Y7Rr5TuqZwPam7EA-cd59Q_jSVgad-D";

/* Chave do site do Cloudflare Turnstile: o captcha da entrada por e-mail e
   senha. A chave do site e publica por design; o segredo fica so no painel do
   Supabase e nos segredos das funcoes, nunca aqui.

   Vazia = captcha desligado, e a tela funciona exatamente como antes. Basta
   preencher para ligar, sem mexer em mais nada.

   Entra em dois lugares, os dois de fora da APSIS:
     - entrar com e-mail e senha;
     - pedir o link para definir a senha.
   A entrada pela conta Microsoft nao passa por aqui: quem usa aquele botao ja
   e verificado pela propria Microsoft. */
window.CAPTCHA_SITE_KEY = "";
