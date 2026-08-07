/* Enviar as datas do cronograma para a Claro aprovar.
 *
 * Isto e um arquivo separado porque a data do cronograma e gravada em TRES
 * lugares: a linha da tela de Cronograma, o formulario "Novo cronograma" e o
 * cadastro da unidade na tela de EPOs. Os tres gravam SEM enviar - e certo, quem
 * monta um ciclo preenche varias unidades antes de estar pronto para mandar.
 *
 * O problema era o depois: a data ficava guardada e ninguem enviava. A unidade
 * nao aparecia em caixa nenhuma, a Claro nao sabia que havia o que aprovar, e o
 * cronograma parecia montado dos dois lados sem estar combinado de nenhum.
 *
 * Entao os tres passam a perguntar, e perguntam pelo mesmo lugar: escrito tres
 * vezes, um deles esqueceria o e-mail no primeiro ajuste - e seria justamente o
 * caminho que ninguem testa.
 *
 * Quem decide O QUE esta pendente e o servidor, e nao a tela que chamou: a tela
 * de EPOs nao tem a lista do cronograma na mao, e a de Cronograma teria uma
 * lista possivelmente velha. Uma consulta so responde para as duas.
 */
(function () {
  "use strict";

  // Uma pergunta por vez. Duas coisas que terminam juntas (a planilha grava e a
  // lista recarrega logo depois) perguntariam duas vezes.
  var perguntando = false;

  function pendentes(db, ciclo) {
    if (!db) return Promise.resolve([]);
    var q = db.from("cronograma_itens")
      .select("id, epos!inner(nome)")
      .eq("situacao", "sem_data")
      .not("data_prevista_inicio", "is", null);
    if (ciclo) q = q.eq("ciclo", ciclo);
    return q.then(function (r) {
      // Sem permissao ou sem conexao a resposta e vazia, e nao um erro na cara
      // de quem acabou de salvar: o que ele fez deu certo.
      return (r && !r.error && r.data) ? r.data : [];
    }, function () { return []; });
  }

  // O e-mail para a gerencia da Claro.
  //
  // Nao leva id nenhum: quem decide o que avisar e o banco, que ja sabe o que
  // esta esperando e o que ja foi avisado. Por isso chamar duas vezes nao manda
  // o e-mail duas vezes.
  //
  // Falha calada de proposito. As datas FORAM enviadas; se o e-mail nao saiu,
  // dizer "nao deu certo" faria a pessoa mandar de novo achando que nao valeu.
  // A tarefa diaria pega o que ficou.
  function avisarGerencia(db) {
    if (!db || !db.functions || !db.functions.invoke) return;
    db.functions.invoke("avisar-aprovacao", { body: {} })
      .then(function () {}, function () {});
  }

  function enviar(db, lista, aoTerminar) {
    var ids = lista.map(function (x) { return x.id; });
    return db.rpc("cronograma_enviar_aprovacao", { p_itens: ids, p_mensagem: null })
      .then(function (r) {
        if (!r || r.error) throw new Error((r && r.error && r.error.message) || "");
        var n = (r.data && r.data.enviados) || 0;
        if (window.App && App.toast) {
          App.toast(n + (n === 1 ? " data enviada." : " datas enviadas."));
        }
        avisarGerencia(db);
        if (aoTerminar) return aoTerminar();
      })
      .catch(function (e) {
        if (window.App && App.toast) {
          App.toast(e && e.message ? e.message
                                   : "Nao foi possivel enviar agora. Tente novamente.");
        }
      });
  }

  /* opcoes:
   *   db          cliente do projeto (Auth.cliente)
   *   ciclo       ciclo em uso; sem ele, olha todos
   *   pode        false = nem pergunta (quem nao monta cronograma nao envia)
   *   aoTerminar  o que fazer depois de enviar (recarregar a lista da tela)
   */
  function oferecer(opcoes) {
    var o = opcoes || {};
    if (!o.db || o.pode === false || perguntando) return Promise.resolve(false);
    if (!window.App || !App.confirmar) return Promise.resolve(false);

    perguntando = true;
    return pendentes(o.db, o.ciclo).then(function (lista) {
      if (!lista.length) { perguntando = false; return false; }

      var n = lista.length;
      var uma = n === 1;

      // Ate tres nomes. Passando disso a caixa vira lista, e a lista completa
      // esta na tela de Cronograma - que e para onde a pessoa vai depois.
      var nomes = lista.slice(0, 3).map(function (x) {
        return (x.epos && x.epos.nome) || "";
      }).filter(Boolean);
      var quais = nomes.length
        ? "\n\n" + nomes.join(", ") + (n > nomes.length ? " e mais " + (n - nomes.length) + "." : ".")
        : "";

      return App.confirmar({
        titulo: uma ? "Enviar a data para a Claro?" : "Enviar as datas para a Claro?",
        texto: (uma ? "Uma data está cadastrada e ainda não foi enviada."
                    : n + " datas estão cadastradas e ainda não foram enviadas.") + quais +
               "\n\nAo enviar, os gerentes da Claro recebem um e-mail e respondem por " +
               "aqui, aprovando ou sugerindo outra data. Enquanto não houver envio, a " +
               "visita não é marcada e o responsável da unidade não é avisado." +
               "\n\nDá para enviar depois, pelo botão no topo do Cronograma.",
        confirmar: uma ? "Enviar a data" : "Enviar as " + n + " datas",
        cancelar: "Agora não"
      }).then(function (ok) {
        perguntando = false;
        if (!ok) return false;
        return enviar(o.db, lista, o.aoTerminar).then(function () { return true; });
      }, function () {
        // Sem isto, uma falha na caixa deixaria a trava ligada e a pergunta nao
        // apareceria mais ate recarregar a tela.
        perguntando = false;
        return false;
      });
    }, function () { perguntando = false; return false; });
  }

  window.EnvioCronograma = { oferecer: oferecer, pendentes: pendentes };
})();
