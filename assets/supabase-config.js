/* Configuração pública do Supabase (Auditoria de EPOs).
   A chave "publishable" é pública por design - a segurança real está no RLS. */
window.SUPABASE_URL = "https://vpkxoyfbxgnizymaurek.supabase.co";
window.SUPABASE_KEY = "sb_publishable_Y7Rr5TuqZwPam7EA-cd59Q_jSVgad-D";

/* Chave do site do Cloudflare Turnstile: o captcha da entrada por código.

   A chave do site é pública por design - ela só aparece na tela. O segredo
   (TURNSTILE_SECRET) fica nos segredos das funções do projeto, nunca aqui.

   Vazia = captcha desligado, e a tela funciona exatamente como hoje. A entrada
   continua freada pelo que o servidor já faz: um pedido de código por minuto
   para o mesmo endereço, e cinco tentativas por código antes de ele ser apagado.

   Onde ele vale quando ligado - os dois passos da entrada de quem não é da
   APSIS:
     - pedir o código (função enviar-codigo-entrada);
     - digitar o código (função confirmar-codigo-entrada).
   A entrada pela conta Microsoft não passa por aqui: quem usa aquele botão já é
   verificado pela própria Microsoft.

   COMO LIGAR, e a ordem importa:
     1. Na Cloudflare: Turnstile, "Add site", domínio auditoria.parceirosclaro.apsis.com.br
        (acrescente localhost para testar). Guarde a chave do site e o segredo.
     2. Cole a chave do site na linha abaixo e publique. A tela passa a mostrar o
        desafio e a mandar o token; o servidor ainda ignora, então nada quebra.
     3. Só então cadastre TURNSTILE_SECRET nos segredos das funções (painel do
        projeto, Edge Functions, Secrets). A conferência passa a valer.
   Na ordem inversa o servidor exigiria um token que a tela ainda não manda, e
   ninguém entraria.

   Depois de ligado: se a Cloudflare não responder, o servidor NEGA a entrada -
   é o lado seguro. Para desligar às pressas, apague o segredo TURNSTILE_SECRET;
   o efeito é imediato e não depende de publicar o site. */
window.CAPTCHA_SITE_KEY = "";
