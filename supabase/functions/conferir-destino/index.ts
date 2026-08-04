// Desativada.
//
// Existiu para diagnostico, quando nao havia como reproduzir a falha de envio
// sem uma sessao de usuario. Cumpriu o papel duas vezes:
//   30/07/2026 - apontou AADSTS7000215: o segredo do app do Azure cadastrado
//                com o ID em vez do valor;
//   03/08/2026 - confirmou credencial valida, Mail.Send concedido e remetente
//                configurado, e provou que o caminho do convite chega ao link
//                de senha (era ali que estava o 422).
//
// Fica desativada porque respondia SEM exigir login - era assim que dava para
// chama-la de fora - e contava quais permissoes o app do Azure tem. Nao expunha
// segredo nem dado de cliente, mas informacao de infraestrutura nao precisa
// ficar num endereco publico depois que o diagnostico acabou.
//
// Para usar de novo: recuperar a versao anterior no historico do repositorio.
// Pode ser removida de vez no painel: Edge Functions, conferir-destino, Delete.
Deno.serve(function () {
  return new Response(
    JSON.stringify({ ok: false, motivo: "verificador desativado" }),
    { status: 410, headers: { "Content-Type": "application/json" } }
  );
});
