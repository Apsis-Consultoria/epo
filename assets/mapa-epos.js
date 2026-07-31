/* =========================================================================
   Auditoria de EPOs - mapa das EPOs no Brasil.
   Usado na visão geral e no painel gerencial, sempre dentro de um cartão que
   a tela cria vazio e escondido.

   Quem vê: gerente da Claro (papel cliente) e admin da APSIS. O cartão só
   aparece depois de o papel ser conhecido, então não vaza para os outros.

   Selo pela nota da última vistoria enviada/validada; abaixo de bronze vira
   sinal de atenção. Contorno oficial das 5 regiões do IBGE, pintado pela média
   da região.

   window.MapaEpos.montar(idDoCartao)
   Depende de: Leaflet, assets/app.js, assets/geo-br.js, assets/data.js.
   ========================================================================= */
(function () {
  "use strict";

  // Mapa e visao de coordenacao: admin e gestor da APSIS e gerente da Claro.
  // Versao dos arquivos, lida do endereco deste proprio script. Serve para a
  // troca de uma imagem chegar no navegador em vez de ficar presa no cache.
  var VERSAO = (function () {
    var tag = document.querySelector('script[src*="mapa-epos.js"]');
    var achado = tag && String(tag.getAttribute("src") || "").match(/[?&]v=([^&]+)/);
    return achado ? "?v=" + achado[1] : "";
  })();

  var PAPEIS_QUE_VEEM = ["admin", "gestor", "cliente"];

  var SELOS = {
    ouro:    { label: "Ouro",         img: "assets/medalhas/ouro.png" + VERSAO,   cor: "#C08A2B" },
    prata:   { label: "Prata",        img: "assets/medalhas/prata.png" + VERSAO,  cor: "#7E8592" },
    bronze:  { label: "Bronze",       img: "assets/medalhas/bronze.png" + VERSAO, cor: "#B06A3B" },
    critico: { label: "Atenção",      img: "assets/medalhas/alerta.png" + VERSAO, cor: "#EF4444" },
    nenhum:  { label: "Sem vistoria", img: null,                         cor: "#94A3B8" }
  };
  var ORDEM = ["ouro", "prata", "bronze", "critico", "nenhum"];

  function selo(nome) { return SELOS[nome] || SELOS.nenhum; }

  // Selo como imagem; quem ainda não tem vistoria fica com um pino neutro.
  // O pino neutro vem menor que a medalha: é ausência de nota, não um selo.
  function htmlSelo(nomeSelo, lado) {
    var m = selo(nomeSelo);
    if (!m.img) {
      var menor = Math.round(lado * 0.7);
      return '<span class="selo-medalha selo-vazio" style="width:' + menor + 'px;height:' + menor + 'px">' +
        '<i class="ti ti-map-pin" aria-hidden="true"></i></span>';
    }
    return '<img class="selo-medalha" src="' + m.img + '" alt="" aria-hidden="true" ' +
      'style="width:' + lado + 'px;height:' + lado + 'px">';
  }

  function montar(idDoCartao) {
    var card = document.getElementById(idDoCartao || "card-mapa");
    if (!card || typeof L === "undefined" || !window.GeoBR || !window.App) return;

    var esc = App.escapeHtml;
    var ligados = { ouro: true, prata: true, bronze: true, critico: true, nenhum: true };
    var unidades = [];
    var mapa = null, camadaPinos = null, camadas = {};
    var camadaRegioes = null, formaDaRegiao = {}, notasRegiao = [];
    var idMapa = idDoCartao + "-tela";

    function papelDe() {
      // Protótipo e demonstração mostram o mapa: é o que a Claro vê na reunião.
      if (!window.Auth || !Auth.pronto || Auth.modoDemo()) return Promise.resolve("admin");
      return Auth.perfil().then(function (p) { return p ? p.papel : null; });
    }

    function dataBr(iso) {
      if (!iso) return "";
      var p = String(iso).slice(0, 10).split("-");
      return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : "";
    }

    function seloDe(u) {
      if (u.score === null || u.score === undefined) return "nenhum";
      return u.tier || App.tierOf(u.score);
    }

    // ------------------------------------------------------------------ casca
    function montarCasca() {
      card.hidden = false;
      card.classList.add("card-mapa");
      card.innerHTML =
        '<div class="card-header">' +
          '<div class="section-title">' +
            '<h2 class="title">EPOs no Brasil</h2>' +
            '<span class="subtitle">Medalha de cada EPO pela nota da última vistoria · quem está crítico aparece com sinal de atenção</span>' +
          "</div>" +
        "</div>" +
        '<div class="selo-filtros" data-filtros></div>' +
        '<div class="mapa-fora" data-fora hidden></div>' +
        '<div class="mapa-layout">' +
          '<div class="mapa-caixa">' +
            '<div class="mapa-camadas">' +
              '<button type="button" data-camada="ruas" class="is-on"><i class="ti ti-map" aria-hidden="true"></i>Ruas</button>' +
              '<button type="button" data-camada="satelite"><i class="ti ti-satellite" aria-hidden="true"></i>Satélite</button>' +
            "</div>" +
            '<div class="mapa-tela" id="' + idMapa + '"></div>' +
          "</div>" +
          '<div class="regioes-painel">' +
            "<h3>Nota por região</h3>" +
            "<div data-regioes></div>" +
            '<p class="regioes-rodape">Média das notas das EPOs de cada região. A cor da região no mapa segue a mesma média.</p>' +
          "</div>" +
        "</div>";
    }

    function noCard(sel) { return card.querySelector(sel); }

    // ------------------------------------------------------------------- mapa
    function criarMapa() {
      mapa = L.map(idMapa, {
        center: GeoBR.CENTRO,
        zoom: 4,
        scrollWheelZoom: false   // a roda continua rolando a página
      });
      mapa.on("click", function () { mapa.scrollWheelZoom.enable(); });
      mapa.on("mouseout", function () { mapa.scrollWheelZoom.disable(); });

      camadas.ruas = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18, attribution: "&copy; OpenStreetMap"
      });
      camadas.satelite = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 18, attribution: "Imagens: Esri" }
      );
      camadas.ruas.addTo(mapa);
      camadaPinos = L.layerGroup().addTo(mapa);

      noCard(".mapa-camadas").addEventListener("click", function (ev) {
        var b = ev.target.closest("[data-camada]");
        if (!b) return;
        var qual = b.getAttribute("data-camada");
        Object.keys(camadas).forEach(function (k) {
          if (mapa.hasLayer(camadas[k])) mapa.removeLayer(camadas[k]);
        });
        camadas[qual].addTo(mapa);
        card.querySelectorAll(".mapa-camadas button").forEach(function (el) {
          el.classList.toggle("is-on", el === b);
        });
      });
    }

    // A medalha entra direto no mapa, sem moldura. Tamanho grande o suficiente
    // para o metal e as estrelas serem reconhecidos de longe.
    var LADO_PINO = 46;

    function iconeDe(u) {
      var meio = LADO_PINO / 2;
      return L.divIcon({
        className: "",
        html: '<div class="pino-mapa">' + htmlSelo(u.selo, LADO_PINO) + "</div>",
        iconSize: [LADO_PINO, LADO_PINO],
        iconAnchor: [meio, meio],
        popupAnchor: [0, -meio + 2]
      });
    }

    function baloneDe(u) {
      var m = selo(u.selo);
      var local = [u.cidade, u.uf].filter(Boolean).join(" · ");
      var nota = (u.score === null || u.score === undefined)
        ? '<p class="pop-obs">Ainda sem vistoria registrada.</p>'
        : '<div class="pop-linha">' + htmlSelo(u.selo, 34) +
          '<span class="pop-score">' + App.fmtNum(u.score) + "</span>" +
          '<span class="badge ' + App.tierMeta(u.selo).cls + '">' + esc(m.label) + "</span></div>" +
          (u.dataVisita ? '<p class="pop-obs">Última vistoria em ' + esc(u.dataVisita) + ".</p>" : "");
      var aviso = u.precisao === "endereco" ? "" :
        '<p class="pop-obs">Posição aproximada pel' +
        (u.precisao === "cidade" ? "a cidade: o endereço" : "o estado: cidade e endereço") +
        " ainda não está no cadastro da EPO.</p>";
      return '<p class="pop-nome">' + esc(u.nome) + "</p>" +
        '<p class="pop-local">' + esc(local || "Local não informado") + "</p>" +
        nota + aviso +
        '<a class="pop-btn" href="epo-detalhe.html?id=' + encodeURIComponent(u.id) + '">' +
        '<i class="ti ti-arrow-right" aria-hidden="true"></i>Ver a EPO</a>';
    }

    function visiveis() {
      return unidades.filter(function (u) { return u.ponto && ligados[u.selo]; });
    }

    function enquadrar() {
      var lista = visiveis();
      if (lista.length) {
        mapa.fitBounds(lista.map(function (u) { return u.ponto; }), { padding: [40, 40], maxZoom: 10 });
      } else {
        mapa.fitBounds(GeoBR.LIMITES);
      }
    }

    function desenharPinos() {
      camadaPinos.clearLayers();
      visiveis().forEach(function (u) {
        L.marker(u.ponto, { icon: iconeDe(u), title: u.nome })
          .bindPopup(baloneDe(u), { maxWidth: 300 })
          .addTo(camadaPinos);
      });
      enquadrar();
    }

    // ---------------------------------------------------------------- filtros
    function renderFiltros() {
      var cont = noCard("[data-filtros]");
      var conta = {};
      ORDEM.forEach(function (s) { conta[s] = 0; });
      unidades.forEach(function (u) { conta[u.selo] += 1; });

      cont.innerHTML = ORDEM.filter(function (s) { return conta[s] > 0; }).map(function (s) {
        return '<button class="selo-chip" type="button" data-selo="' + s + '" aria-pressed="true">' +
          htmlSelo(s, 22) + esc(selo(s).label) + " <b>" + conta[s] + "</b></button>";
      }).join("");

      var presentes = ORDEM.filter(function (s) { return conta[s] > 0; });

      // Clicar numa medalha foca nela: o mapa passa a mostrar só aquelas EPOs.
      // Clicar de novo na mesma volta a mostrar todas. Antes o clique apagava
      // justamente a medalha escolhida, o contrário do que a legenda sugere.
      function pintarChips() {
        var focada = presentes.filter(function (s) { return ligados[s]; });
        var emFoco = focada.length === 1 && presentes.length > 1 ? focada[0] : null;
        Array.prototype.forEach.call(cont.querySelectorAll("[data-selo]"), function (b) {
          var s = b.getAttribute("data-selo");
          b.classList.toggle("is-off", !ligados[s]);
          b.classList.toggle("is-foco", s === emFoco);
          b.setAttribute("aria-pressed", ligados[s] ? "true" : "false");
        });
      }

      cont.addEventListener("click", function (ev) {
        var b = ev.target.closest("[data-selo]");
        if (!b) return;
        var s = b.getAttribute("data-selo");
        var jaFocada = ligados[s] && presentes.every(function (x) {
          return ligados[x] === (x === s);
        });
        presentes.forEach(function (x) { ligados[x] = jaFocada ? true : (x === s); });
        pintarChips();
        desenharPinos();
      });

      pintarChips();
    }

    // ---------------------------------------------------------------- regiões
    // Nota da região = média das notas das EPOs dela. EPO sem vistoria não entra
    // na média, senão uma EPO nova derrubaria a nota da região inteira.
    function calcularRegioes() {
      notasRegiao = GeoBR.REGIOES.map(function (r) {
        var minhas = unidades.filter(function (u) {
          return u.regiao && u.regiao.id === r.id;
        });
        var comNota = minhas.filter(function (u) { return u.score !== null; });
        var media = comNota.length
          ? Math.round(comNota.reduce(function (s, u) { return s + u.score; }, 0) / comNota.length)
          : null;
        return {
          id: r.id, nome: r.nome,
          quantos: minhas.length, comNota: comNota.length,
          media: media,
          selo: media === null ? "nenhum" : App.tierOf(media)
        };
      });
    }

    function notaDaRegiao(id) {
      for (var i = 0; i < notasRegiao.length; i++) {
        if (notasRegiao[i].id === id) return notasRegiao[i];
      }
      return null;
    }

    function estiloDaRegiao(id) {
      var n = notaDaRegiao(id);
      if (!n || n.media === null) {
        return { color: "#CBD5E1", weight: 1.2, opacity: .9, fillColor: "#94A3B8", fillOpacity: .05 };
      }
      var cor = selo(n.selo).cor;
      return { color: cor, weight: 1.6, opacity: .7, fillColor: cor, fillOpacity: .14 };
    }

    // Com o mouse em cima, a região inteira fica na cor cheia: é o que mostra
    // de longe qual é a região e como ela está.
    function estiloForte(id) {
      var n = notaDaRegiao(id);
      var cor = (!n || n.media === null) ? "#94A3B8" : selo(n.selo).cor;
      return { color: cor, weight: 3, opacity: 1, fillColor: cor, fillOpacity: .42 };
    }

    function destacarRegiao(id, ligar) {
      var forma = formaDaRegiao[id];
      if (!forma) return;
      forma.setStyle(ligar ? estiloForte(id) : estiloDaRegiao(id));
      if (ligar) forma.bringToFront();
      if (camadaPinos) camadaPinos.bringToFront();
    }

    function renderRegioes() {
      var alvo = noCard("[data-regioes]");
      if (!alvo) return;
      alvo.innerHTML = notasRegiao.map(function (n) {
        var vazia = n.media === null;
        var detalhe = !n.quantos
          ? "nenhuma EPO"
          : n.quantos + (n.quantos === 1 ? " EPO" : " EPOs") +
            (n.comNota < n.quantos ? " · " + (n.quantos - n.comNota) + " sem vistoria" : "");
        return '<button class="reg-linha' + (vazia ? " is-vazia" : "") + '" type="button" ' +
          'data-regiao="' + n.id + '"' + (vazia ? " disabled" : "") + ">" +
          htmlSelo(n.selo, 24) +
          '<span class="reg-info"><b>' + esc(n.nome) + "</b><span>" + esc(detalhe) + "</span></span>" +
          '<span class="reg-nota">' + (vazia ? "<small>sem nota</small>" : App.fmtNum(n.media)) + "</span>" +
          "</button>";
      }).join("");

      alvo.addEventListener("click", function (ev) {
        var b = ev.target.closest("[data-regiao]");
        if (!b || b.disabled) return;
        var forma = formaDaRegiao[b.getAttribute("data-regiao")];
        if (forma && mapa) mapa.fitBounds(forma.getBounds(), { padding: [30, 30] });
      });
      alvo.addEventListener("mouseover", function (ev) {
        var b = ev.target.closest("[data-regiao]");
        if (b) destacarRegiao(b.getAttribute("data-regiao"), true);
      });
      alvo.addEventListener("mouseout", function (ev) {
        var b = ev.target.closest("[data-regiao]");
        if (b) destacarRegiao(b.getAttribute("data-regiao"), false);
      });
    }

    // Contorno oficial das 5 regiões, servido pelo próprio sistema. Se o arquivo
    // não vier, o mapa segue sem contorno: a nota por região sai da UF da EPO.
    function desenharRegioes() {
      return fetch(GeoBR.DESENHO_REGIOES, { cache: "force-cache" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (geo) {
          if (!geo || !geo.features || !mapa) return;
          camadaRegioes = L.geoJSON(geo, {
            style: function (f) { return estiloDaRegiao(String(f.properties.codarea)); },
            onEachFeature: function (f, camada) {
              var id = String(f.properties.codarea);
              formaDaRegiao[id] = camada;
              camada.on("mouseover", function () { destacarRegiao(id, true); });
              camada.on("mouseout", function () { destacarRegiao(id, false); });
              camada.on("click", function () {
                mapa.fitBounds(camada.getBounds(), { padding: [30, 30] });
              });
            }
          });
          camadaRegioes.addTo(mapa);          // entra antes dos pinos
          if (camadaPinos) camadaPinos.bringToFront();
        })
        .catch(function (e) { console.warn("contorno das regiões:", e); });
    }

    // -------------------------------------------------------------- tamanho
    // O mapa nasce dentro de um cartão que ainda está sendo montado, e o menu
    // lateral pode recolher depois. Sem recalcular, o mapa fica com as peças
    // fora de lugar.
    function reagirAoTamanho() {
      var caixa = document.getElementById(idMapa);
      var ultimo = 0;
      var enquadrado = false;
      var recalcular = function () {
        if (!mapa || !caixa) return;
        var l = caixa.clientWidth;
        if (l === ultimo) return;
        ultimo = l;
        if (l <= 0) return;
        mapa.invalidateSize();
        // O primeiro enquadramento pode ter acontecido com o cartão ainda sem
        // largura, e aí o mapa abre com zoom errado, mostrando só um pedaço do
        // Brasil. Agora que ele sabe o próprio tamanho, enquadra de novo.
        if (!enquadrado) { enquadrado = true; enquadrar(); }
      };
      setTimeout(recalcular, 60);
      window.addEventListener("resize", recalcular);
      if (typeof ResizeObserver === "function") {
        new ResizeObserver(recalcular).observe(caixa);
      }
    }

    function renderFora() {
      var fora = unidades.filter(function (u) { return !u.ponto; });
      var el = noCard("[data-fora]");
      if (!fora.length) { el.hidden = true; return; }
      el.hidden = false;
      el.innerHTML = '<i class="ti ti-map-pin-off" aria-hidden="true"></i> ' +
        "Sem cidade nem endereço no cadastro, fora do mapa: " +
        fora.map(function (u) { return esc(u.nome); }).join(", ") + ".";
    }

    // ------------------------------------------------------------------ dados
    function preparar(brutos) {
      unidades = brutos.map(function (e) {
        var pos = GeoBR.pontoDaEpo(e);
        var u = {
          id: e.id, nome: e.nome, cidade: e.cidade || "", uf: e.uf || "",
          score: (e.score === null || e.score === undefined) ? null : Number(e.score),
          tier: e.tier || null,
          dataVisita: dataBr(e.dataVisita),
          ponto: pos.ponto, precisao: pos.precisao,
          regiao: GeoBR.regiaoDaUf(e.uf)
        };
        u.selo = seloDe(u);
        return u;
      });
      if (!unidades.length) return false;
      GeoBR.espalhar(unidades);
      calcularRegioes();
      return true;
    }

    function desenhar() {
      montarCasca();
      criarMapa();
      renderFiltros();
      renderFora();
      renderRegioes();
      desenharRegioes();
      desenharPinos();
      reagirAoTamanho();
    }

    function daDemo() {
      return ((window.APP && APP.epos) || []).map(function (e) {
        return {
          id: e.id, nome: e.nome, cidade: e.cidade, uf: e.uf,
          endereco: e.endereco || null, lat: e.lat, lng: e.lng,
          score: e.score, tier: e.tier,
          dataVisita: (e.vistorias && e.vistorias.length)
            ? e.vistorias[e.vistorias.length - 1].data : null
        };
      });
    }

    function doBanco() {
      var db = Auth.cliente;
      return db.from("epos")
        .select("id, nome, cidade, uf, endereco, lat, lng")
        .eq("ativo", true).order("nome")
        .then(function (r) {
          if (r.error) throw new Error(r.error.message);
          var lista = r.data || [];
          if (!lista.length) return [];
          return db.from("auditorias")
            .select("epo_id, score, tier, data_visita, enviada_em, status")
            .in("status", ["enviada", "validada"])
            .order("data_visita", { ascending: false })
            .then(function (ra) {
              var ultima = {};
              if (!ra.error) {
                (ra.data || []).forEach(function (a) {
                  if (!ultima[a.epo_id]) ultima[a.epo_id] = a;
                });
              }
              return lista.map(function (e) {
                var a = ultima[e.id];
                e.score = a ? a.score : null;
                e.tier = a ? a.tier : null;
                e.dataVisita = a ? (a.data_visita || a.enviada_em) : null;
                return e;
              });
            });
        });
    }

    papelDe().then(function (papel) {
      if (PAPEIS_QUE_VEEM.indexOf(papel) < 0) return;
      var usaBanco = window.Auth && Auth.pronto && Auth.cliente && !Auth.modoDemo();
      if (!usaBanco) {
        if (preparar(daDemo())) desenhar();
        return;
      }
      return doBanco().then(function (brutos) {
        if (preparar(brutos)) desenhar();
      }, function (err) {
        console.error("mapa das EPOs:", err);
      });
    }).catch(function (err) {
      console.error("mapa das EPOs:", err);
    });
  }

  window.MapaEpos = { montar: montar, SELOS: SELOS, htmlSelo: htmlSelo };
})();
