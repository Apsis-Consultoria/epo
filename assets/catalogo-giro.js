/* Catalogo de itens da reversa (giro).

   O catalogo NAO mora mais aqui. Este arquivo era uma lista com 1.064 codigos
   SAP do cliente - tecnologia, tipo e categoria de cada equipamento - gerada da
   planilha DexPara_Info_reversa_GIRO. Dois problemas, e o segundo e o que pesa:
   o repositorio e publico, e o SITE tambem servia o arquivo, sem login, porque a
   tela de contagem depende dele. Tornar o repositorio privado resolveria o
   primeiro e nao o segundo.

   Agora o catalogo esta na tabela catalogo_giro, e quem le e quem alcanca a tela
   de contagem: com sessao, com papel e com o segundo fator conferido, como todo
   o resto do sistema. Alterar o catalogo e da coordenacao da APSIS.

   O que sobrou aqui e o carregador. Ele mantem window.CATALOGO_GIRO, que e como
   a tela e o leitor de planilha ja liam o catalogo, e expoe uma promessa para
   quem precisa esperar a lista chegar antes de desenhar. */
(function () {
  "use strict";

  window.CATALOGO_GIRO = [];

  var promessa = null;

  function carregar() {
    if (promessa) return promessa;

    var db = window.Auth ? Auth.cliente : null;
    if (!db) {
      // Sem sessao nao ha catalogo. A tela de contagem so abre com sessao; este
      // caminho existe para a tela de demonstracao nao quebrar.
      promessa = Promise.resolve([]);
      return promessa;
    }

    promessa = db.from("catalogo_giro")
      .select("cod, tec, tipo, giro, cat")
      .order("cod")
      .then(function (r) {
        if (r.error) throw r.error;
        window.CATALOGO_GIRO = r.data || [];
        return window.CATALOGO_GIRO;
      });
    return promessa;
  }

  window.CatalogoGiro = { carregar: carregar };
})();
