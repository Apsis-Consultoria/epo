/* =========================================================================
   Dados reais para as telas de leitura.

   Visao geral, Ranking, Comparativo e Painel gerencial nasceram lendo um
   catalogo de exemplo escrito no proprio codigo. Elas nunca falaram com o
   cadastro: mostravam sempre as mesmas unidades inventadas, com nota, tempo
   de ciclo e historico que nao existiam em lugar nenhum.

   Este arquivo le o cadastro de verdade e monta a mesma forma que aquelas
   telas ja consomem. Assim elas nao precisaram ser reescritas, e passam a
   mostrar o que existe: se nao existe nada, mostram vazio.

   Uso na tela:
     <script src="assets/dados-reais.js?v=N"></script>
     ...
     DadosReais.entao(function () { ...o codigo da tela... });

   A promessa NUNCA e recusada. Se a leitura falhar, as telas abrem com as
   listas vazias em vez de nao abrir: tela que nao carrega e pior que tela
   sem numero.
   ========================================================================= */
(function () {
  "use strict";

  // Unidade sem auditoria ainda nao tem nota, tempo nem historico. Os campos
  // existem com valor neutro porque as telas os acessam direto: faltar campo
  // aqui viraria erro de tela na primeira unidade cadastrada.
  function unidadeVazia(e) {
    return {
      id: e.id,
      nome: e.nome || "",
      cidade: e.cidade || "",
      uf: e.uf || "",
      cod: e.cod_fornecedor || "",
      regional: e.uf || "",
      endereco: e.endereco || "",
      cep: e.cep || "",
      lat: e.lat,
      lng: e.lng,
      ativo: e.ativo !== false,
      score: null,
      tier: null,
      equipamentos: 0,
      equipamentosParados: 0,
      conformidade: null,
      ncs: 0,
      tempos: { chegada: null, armazenagem: null, distribuicao: null,
                retornoCampo: null, devolucao: null },
      reversa: {
        aderenciaCalendario: null, volumeDevolvido: 0, saldoSistema: 0,
        pctFontes: null, pctControles: null, metaFontes: null, metaControles: null,
        altoGiro: { equipamentos: 0, fontes: 0, controles: 0 }
      },
      historico: [],
      processos: [],
      // Ranking, Comparativo, Detalhe da EPO e Painel gerencial leem a nota
      // por questionario daqui, no formato { data, label, score, secoes: [...] }.
      // Este carregador nunca montava esta lista, entao as quatro telas diziam
      // "sem vistoria registrada" mesmo com auditoria enviada no banco.
      vistorias: []
    };
  }

  function tierDaNota(nota, regras) {
    if (nota == null) return null;
    var r = regras || { ouroMin: 85, prataMin: 70, bronzeMin: 55 };
    if (nota >= r.ouroMin) return "ouro";
    if (nota >= r.prataMin) return "prata";
    if (nota >= r.bronzeMin) return "bronze";
    return "critico";
  }

  function media(lista) {
    var v = lista.filter(function (x) { return x != null && !isNaN(x); });
    if (!v.length) return null;
    var soma = 0;
    v.forEach(function (x) { soma += Number(x); });
    return Math.round(soma / v.length);
  }

  // As telas contam quantas unidades estao em cada selo. Sem unidade nenhuma,
  // os quatro selos ficam em zero em vez de a chave faltar.
  function distribuicaoVazia() {
    return { ouro: 0, prata: 0, bronze: 0, critico: 0 };
  }

  function kpisDe(unidades) {
    var dist = distribuicaoVazia();
    var parados = 0, ncs = 0;
    unidades.forEach(function (u) {
      if (u.tier && dist.hasOwnProperty(u.tier)) dist[u.tier] += 1;
      parados += u.equipamentosParados || 0;
      ncs += u.ncs || 0;
    });
    var comNota = unidades.filter(function (u) { return u.score != null; });
    return {
      eposAuditadas: comNota.length,
      equipParados: parados,
      tempoMedioCiclo: null,
      tempoMedioParada: null,
      conformidadeMedia: media(unidades.map(function (u) { return u.conformidade; })),
      ncTotal: ncs,
      distribuicao: dist,
      reversaQualidadeMedia: {
        pctFontes: media(unidades.map(function (u) { return u.reversa.pctFontes; })),
        pctControles: media(unidades.map(function (u) { return u.reversa.pctControles; }))
      }
    };
  }

  function aplicar(unidades, processos) {
    if (!window.APP) return;
    window.APP.epos = unidades;
    window.APP.kpis = kpisDe(unidades);
    // Sem auditoria enviada nao ha achado nem anexo para listar.
    window.APP.evidencias = window.APP.evidencias || [];
    window.APP.anexosRecebidos = window.APP.anexosRecebidos || [];
    if (processos && processos.length) {
      window.APP.processos = processos;
      window.APP.checklist = processos;
    }
  }

  var MESES = ["jan", "fev", "mar", "abr", "mai", "jun",
               "jul", "ago", "set", "out", "nov", "dez"];

  function rotuloDoMes(iso) {
    if (!iso) return "";
    var p = String(iso).slice(0, 10).split("-");
    if (p.length < 2) return "";
    var m = Number(p[1]);
    if (!m || m < 1 || m > 12) return "";
    return MESES[m - 1] + "/" + String(p[0]).slice(2);
  }

  // Cortes do selo, como estao gravados na tela de Questionarios. Antes so
  // existiam escritos no codigo: mexer nos cortes nao mudava selo nenhum.
  function lerCortes(db) {
    return db.from("metas").select("chave, valor")
      .in("chave", ["tier_ouro", "tier_prata", "tier_bronze"])
      .then(function (r) {
        if (!r || r.error || !r.data || !r.data.length) return null;
        var mapa = {};
        r.data.forEach(function (m) {
          var v = Number(m.valor);
          if (!isNaN(v)) mapa[m.chave] = v;
        });
        if (!window.APP || !window.APP.tierRules) return null;
        if (mapa.tier_ouro != null) window.APP.tierRules.ouroMin = mapa.tier_ouro;
        if (mapa.tier_prata != null) window.APP.tierRules.prataMin = mapa.tier_prata;
        if (mapa.tier_bronze != null) window.APP.tierRules.bronzeMin = mapa.tier_bronze;
        return null;
      }, function () { return null; });
  }

  function lerCadastro(db) {
    var unidades = [];
    var auditorias = [];
    var regras = null;

    return lerCortes(db).then(function () {
    regras = (window.APP && window.APP.tierRules) || null;
    return db.from("epos")
      .select("id, nome, cidade, uf, endereco, cep, lat, lng, ativo, cod_fornecedor, " +
              "responsavel_nome, responsavel_email")
      .order("nome")
      .then(function (r) {
        // Erro de leitura virando lista vazia esconderia o problema. Sobe, e
        // quem chamou decide: aqui, abrir vazio com o aviso da propria tela.
        if (r.error) throw new Error(r.error.message || "falha ao ler as unidades");
        unidades = (r.data || []).map(unidadeVazia);
        if (!unidades.length) return { data: [], error: null };
        return db.from("auditorias")
          .select("id, epo_id, processo_id, score, tier, status, data_visita, criado_em")
          .in("status", ["enviada", "validada"])
          .order("criado_em", { ascending: false });
      })
      .then(function (r) {
        if (r && r.error) throw new Error(r.error.message || "falha ao ler as auditorias");
        auditorias = (r && r.data) ? r.data : [];
        return db.from("processos")
          .select("id, nome, slug, icone, peso, descricao")
          .order("peso", { ascending: false });
      })
      .then(function (r) {
        var procsDb = (r && !r.error && r.data) ? r.data : [];
        var nomeDoProc = {};
        procsDb.forEach(function (p) {
          // A cor de cada questionario no ranking e escolhida pelo slug, e nao
          // pelo id: sem o slug, todo questionario cairia na cor de reserva.
          nomeDoProc[p.id] = { nome: p.nome, slug: p.slug || p.id };
        });

        var porEpo = {};
        auditorias.forEach(function (a) {
          if (!porEpo[a.epo_id]) porEpo[a.epo_id] = {};
          // A consulta vem da mais recente para a mais antiga: a primeira de
          // cada par unidade e questionario e a que vale.
          if (!porEpo[a.epo_id][a.processo_id]) porEpo[a.epo_id][a.processo_id] = a;
        });

        unidades.forEach(function (u) {
          var doEpo = porEpo[u.id];
          if (!doEpo) return;
          var notas = [];
          var secoes = [];
          var maisRecente = "";
          Object.keys(doEpo).forEach(function (pid) {
            var a = doEpo[pid];
            var info = nomeDoProc[pid] || { nome: "Questionário", slug: pid };
            if (a.score != null) notas.push(Number(a.score));
            u.processos.push({ id: pid, score: a.score, tier: a.tier,
                               dataVisita: a.data_visita });
            // Questionario sem nota (todos os itens "nao se aplica") fica fora
            // da barra: mostrar 0% ali diria que a unidade foi mal.
            if (a.score != null) {
              secoes.push({ processoId: info.slug, nome: info.nome,
                            pct: Math.round(Number(a.score)), itens: [] });
            }
            var d = a.data_visita || "";
            if (d > maisRecente) maisRecente = d;
          });
          u.score = media(notas);
          u.tier = tierDaNota(u.score, regras);
          u.conformidade = u.score;

          // Uma vistoria por unidade: a foto do que ja foi enviado. As telas
          // leem sempre a ultima da lista, entao uma basta enquanto nao houver
          // ciclos separados.
          if (secoes.length) {
            secoes.sort(function (x, y) { return y.pct - x.pct; });
            u.vistorias = [{
              data: maisRecente || null,
              label: rotuloDoMes(maisRecente),
              score: u.score,
              tier: u.tier,
              conformidade: u.score,
              ncs: 0,
              tempoCiclo: null,
              tempos: u.tempos,
              secoes: secoes
            }];
          }
        });

        var procs = procsDb.map(function (p) {
          return { id: p.id, nome: p.nome, icone: p.icone || "ti-clipboard-check",
                   peso: p.peso, descricao: p.descricao || "", itens: [] };
        });
        aplicar(unidades, procs);
        return true;
      });
    });
  }

  var promessa = null;

  function carregar() {
    if (promessa) return promessa;

    var temAuth = window.Auth && window.Auth.pronto && window.Auth.cliente;
    var demo = window.Auth && window.Auth.modoDemo && window.Auth.modoDemo();

    if (!temAuth || demo) {
      // Sem conexao ou em demonstracao: nao inventa nada, so garante que as
      // chaves existem para as telas nao acessarem lista inexistente.
      aplicar((window.APP && window.APP.epos) || [], null);
      promessa = Promise.resolve(false);
      return promessa;
    }

    // A tela de carregamento espera por esta leitura: sem isso a visao geral, o
    // ranking, o comparativo e o painel apareciam vazios e se preenchiam depois.
    promessa = window.Auth.sessao()
      .then(function (s) {
        if (!s) { aplicar([], null); return false; }
        return lerCadastro(window.Auth.cliente);
      })
      .catch(function (e) {
        if (window.console && console.warn) console.warn("dados reais", e);
        aplicar([], null);
        return false;
      });
    if (window.App && App.aguardar) App.aguardar(promessa);
    return promessa;
  }

  window.DadosReais = {
    carregar: carregar,
    entao: function (fn) {
      carregar().then(function () {
        try {
          fn();
        } catch (e) {
          // Engolir o erro aqui deixava a tela EM BRANCO, sem uma palavra:
          // foi o que aconteceu com a visao geral. Erro de montagem passa a
          // aparecer na propria tela, para nunca mais existir tela vazia sem
          // explicacao.
          if (window.console && console.error) console.error(e);
          var alvo = document.getElementById("page");
          if (alvo && !alvo.innerHTML) {
            alvo.innerHTML =
              '<div class="empty">' +
                '<i class="ti ti-alert-triangle" aria-hidden="true"></i>' +
                "<p>Nao foi possivel montar esta tela agora. " +
                "Atualize a pagina em alguns instantes.</p>" +
              "</div>";
          }
        }
      });
    }
  };
})();
