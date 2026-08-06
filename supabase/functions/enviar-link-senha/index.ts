// Desativada em 06/08/2026 pela verificacao de seguranca. NAO REPUBLICAR O
// CONTEUDO ANTERIOR: esta no historico do repositorio, e nao deve voltar.
//
// O que ela fazia: recebia um e-mail, gerava o link de definicao de senha
// daquela conta e mandava. Sem exigir sessao de ninguem - era publica por
// desenho, porque nasceu para o "esqueci a minha senha" - e com a origem da
// requisicao entrando na montagem do link. Duas consequencias: bastava saber o
// endereco de alguem para provocar um pedido de senha no nome dessa pessoa, e um
// pedido feito de fora do site apontava o link para o endereco de quem chamou.
//
// Nenhuma tela chamava: a entrada hoje e por codigo enviado ao e-mail, e o
// convite com link de senha sai de convidar-responsavel, que exige sessao de
// quem convida e monta o endereco aqui dentro, nao a partir do pedido.
//
// Esta casca fica no lugar do codigo para que o endereco nao volte a responder
// enquanto a funcao nao for removida no painel do projeto.
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  return new Response(JSON.stringify({ ok: false, motivo: "recurso desativado" }), {
    status: 410,
    headers: { ...CORS, "Content-Type": "application/json" }
  });
});
