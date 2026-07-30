/* =========================================================================
   Auditoria de EPOs - coordenadas do Brasil.
   Serve ao mapa da primeira tela: uma EPO nunca deve desaparecer do mapa só
   porque o endereço ainda não foi convertido em ponto. A ordem de precisão é:
     1. lat/lng gravados no cadastro (endereço convertido na hora de salvar);
     2. cidade + UF desta tabela;
     3. centro da UF.
   O que cair no 2 ou no 3 aparece marcado como aproximado.
   window.GeoBR
   ========================================================================= */
(function () {
  "use strict";

  // Classe dos acentos escrita em ASCII: marca combinante solta no arquivo
  // depende do editor nao mexer no encoding.
  var ACENTOS = new RegExp("[\u0300-\u036f]", "g");

  // Tira acento, caixa e espaço sobrando para a busca não depender de digitação.
  function chave(texto) {
    return String(texto || "")
      .normalize("NFD").replace(ACENTOS, "")
      .toLowerCase().replace(/\s+/g, " ").trim();
  }

  // Capitais + cidades de maior porte. [lat, lng]
  var CIDADES = {
    // Norte
    "rio branco|ac": [-9.9747, -67.8100],
    "macapa|ap": [0.0389, -51.0664],
    "manaus|am": [-3.1190, -60.0217],
    "belem|pa": [-1.4558, -48.5044],
    "ananindeua|pa": [-1.3656, -48.3722],
    "santarem|pa": [-2.4431, -54.7083],
    "maraba|pa": [-5.3686, -49.1178],
    "porto velho|ro": [-8.7612, -63.9004],
    "ji-parana|ro": [-10.8853, -61.9517],
    "boa vista|rr": [2.8235, -60.6758],
    "palmas|to": [-10.1841, -48.3336],
    "araguaina|to": [-7.1911, -48.2072],
    // Nordeste
    "maceio|al": [-9.6498, -35.7089],
    "arapiraca|al": [-9.7522, -36.6611],
    "salvador|ba": [-12.9777, -38.5016],
    "feira de santana|ba": [-12.2664, -38.9663],
    "vitoria da conquista|ba": [-14.8615, -40.8442],
    "camacari|ba": [-12.6996, -38.3242],
    "fortaleza|ce": [-3.7319, -38.5267],
    "caucaia|ce": [-3.7360, -38.6531],
    "sobral|ce": [-3.6880, -40.3499],
    "juazeiro do norte|ce": [-7.2130, -39.3153],
    "sao luis|ma": [-2.5307, -44.3068],
    "imperatriz|ma": [-5.5264, -47.4919],
    "joao pessoa|pb": [-7.1195, -34.8450],
    "campina grande|pb": [-7.2306, -35.8811],
    "recife|pe": [-8.0476, -34.8770],
    "jaboatao dos guararapes|pe": [-8.1128, -35.0148],
    "olinda|pe": [-8.0089, -34.8553],
    "caruaru|pe": [-8.2829, -35.9761],
    "petrolina|pe": [-9.3891, -40.5030],
    "teresina|pi": [-5.0892, -42.8019],
    "parnaiba|pi": [-2.9055, -41.7767],
    "natal|rn": [-5.7945, -35.2110],
    "mossoro|rn": [-5.1875, -37.3441],
    "aracaju|se": [-10.9472, -37.0731],
    // Centro-Oeste
    "brasilia|df": [-15.7939, -47.8828],
    "goiania|go": [-16.6869, -49.2648],
    "aparecida de goiania|go": [-16.8198, -49.2469],
    "anapolis|go": [-16.3281, -48.9531],
    "cuiaba|mt": [-15.6014, -56.0979],
    "varzea grande|mt": [-15.6467, -56.1325],
    "rondonopolis|mt": [-16.4673, -54.6372],
    "campo grande|ms": [-20.4697, -54.6201],
    "dourados|ms": [-22.2211, -54.8056],
    // Sudeste
    "vitoria|es": [-20.3155, -40.3128],
    "serra|es": [-20.1288, -40.3078],
    "vila velha|es": [-20.3297, -40.2925],
    "cariacica|es": [-20.2632, -40.4164],
    "belo horizonte|mg": [-19.9167, -43.9345],
    "contagem|mg": [-19.9317, -44.0536],
    "betim|mg": [-19.9678, -44.1983],
    "uberlandia|mg": [-18.9186, -48.2772],
    "uberaba|mg": [-19.7472, -47.9381],
    "juiz de fora|mg": [-21.7642, -43.3496],
    "montes claros|mg": [-16.7282, -43.8578],
    "rio de janeiro|rj": [-22.9068, -43.1729],
    "niteroi|rj": [-22.8832, -43.1034],
    "duque de caxias|rj": [-22.7856, -43.3117],
    "nova iguacu|rj": [-22.7592, -43.4510],
    "campos dos goytacazes|rj": [-21.7545, -41.3244],
    "sao paulo|sp": [-23.5505, -46.6333],
    "guarulhos|sp": [-23.4543, -46.5337],
    "campinas|sp": [-22.9099, -47.0626],
    "sao bernardo do campo|sp": [-23.6914, -46.5646],
    "santo andre|sp": [-23.6639, -46.5383],
    "osasco|sp": [-23.5324, -46.7916],
    "sorocaba|sp": [-23.5015, -47.4526],
    "ribeirao preto|sp": [-21.1775, -47.8103],
    "sao jose dos campos|sp": [-23.1791, -45.8872],
    "santos|sp": [-23.9608, -46.3336],
    "jundiai|sp": [-23.1857, -46.8978],
    "piracicaba|sp": [-22.7253, -47.6492],
    "bauru|sp": [-22.3145, -49.0606],
    "sao jose do rio preto|sp": [-20.8113, -49.3758],
    // Sul
    "curitiba|pr": [-25.4284, -49.2733],
    "londrina|pr": [-23.3045, -51.1696],
    "maringa|pr": [-23.4205, -51.9331],
    "ponta grossa|pr": [-25.0916, -50.1668],
    "cascavel|pr": [-24.9555, -53.4552],
    "foz do iguacu|pr": [-25.5478, -54.5882],
    "florianopolis|sc": [-27.5954, -48.5480],
    "joinville|sc": [-26.3044, -48.8456],
    "blumenau|sc": [-26.9155, -49.0709],
    "chapeco|sc": [-27.1004, -52.6152],
    "criciuma|sc": [-28.6775, -49.3697],
    "porto alegre|rs": [-30.0346, -51.2177],
    "caxias do sul|rs": [-29.1678, -51.1794],
    "canoas|rs": [-29.9177, -51.1836],
    "pelotas|rs": [-31.7654, -52.3376],
    "santa maria|rs": [-29.6842, -53.8069]
  };

  // Centro aproximado de cada UF, para o caso de a cidade não estar na lista.
  var UFS = {
    ac: [-9.0, -70.0],   al: [-9.6, -36.6],   ap: [1.4, -51.8],    am: [-4.0, -63.0],
    ba: [-12.5, -41.7],  ce: [-5.2, -39.6],   df: [-15.78, -47.93], es: [-19.6, -40.6],
    go: [-16.0, -49.5],  ma: [-5.0, -45.3],   mt: [-13.0, -55.9],  ms: [-20.5, -54.5],
    mg: [-18.6, -44.5],  pa: [-4.0, -52.5],   pb: [-7.2, -36.5],   pr: [-24.8, -51.5],
    pe: [-8.4, -37.8],   pi: [-7.3, -42.5],   rj: [-22.2, -42.7],  rn: [-5.8, -36.6],
    rs: [-29.7, -53.2],  ro: [-10.9, -62.8],  rr: [2.0, -61.4],    sc: [-27.3, -50.4],
    sp: [-22.2, -48.7],  se: [-10.6, -37.4],  to: [-10.2, -48.3]
  };

  // Índice só por nome de cidade, para quando a UF vier vazia ou trocada.
  var POR_NOME = {};
  Object.keys(CIDADES).forEach(function (k) {
    var nome = k.split("|")[0];
    if (!POR_NOME[nome]) POR_NOME[nome] = CIDADES[k];
  });

  function daCidade(cidade, uf) {
    var c = chave(cidade);
    if (!c) return null;
    var u = chave(uf);
    var exato = CIDADES[c + "|" + u];
    if (exato) return exato.slice();
    var soNome = POR_NOME[c];
    return soNome ? soNome.slice() : null;
  }

  function daUf(uf) {
    var u = chave(uf);
    return UFS[u] ? UFS[u].slice() : null;
  }

  // Ponto de uma EPO + de onde ele veio, para a tela poder avisar quando é
  // aproximado. precisao: 'endereco' | 'cidade' | 'uf' | null
  function pontoDaEpo(epo) {
    if (!epo) return { ponto: null, precisao: null };
    var lat = Number(epo.lat);
    var lng = Number(epo.lng);
    if (isFinite(lat) && isFinite(lng) && (lat !== 0 || lng !== 0)) {
      return { ponto: [lat, lng], precisao: "endereco" };
    }
    var pc = daCidade(epo.cidade, epo.uf);
    if (pc) return { ponto: pc, precisao: "cidade" };
    var pu = daUf(epo.uf);
    if (pu) return { ponto: pu, precisao: "uf" };
    return { ponto: null, precisao: null };
  }

  // Duas EPOs na mesma cidade cairiam exatamente no mesmo ponto e uma esconderia
  // a outra. Espalha em círculo, poucas centenas de metros, mantendo a leitura.
  function espalhar(pontos) {
    var grupos = {};
    pontos.forEach(function (p) {
      if (!p.ponto) return;
      var k = p.ponto[0].toFixed(4) + "," + p.ponto[1].toFixed(4);
      (grupos[k] = grupos[k] || []).push(p);
    });
    Object.keys(grupos).forEach(function (k) {
      var lista = grupos[k];
      if (lista.length < 2) return;
      var raio = 0.035;
      lista.forEach(function (p, i) {
        var ang = (2 * Math.PI * i) / lista.length;
        p.ponto = [p.ponto[0] + raio * Math.sin(ang), p.ponto[1] + raio * Math.cos(ang)];
        p.agrupado = true;
      });
    });
    return pontos;
  }

  // Endereço -> ponto, na hora de salvar o cadastro. Serviço aberto do
  // OpenStreetMap; se não responder, o cadastro salva sem coordenada e o mapa
  // aproxima pela cidade.
  function geocodificar(endereco, cidade, uf) {
    var partes = [endereco, cidade, uf, "Brasil"].filter(Boolean).join(", ");
    var url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=" +
      encodeURIComponent(partes);
    return fetch(url, { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (lista) {
        if (!lista || !lista.length) return null;
        var lat = parseFloat(lista[0].lat);
        var lng = parseFloat(lista[0].lon);
        if (!isFinite(lat) || !isFinite(lng)) return null;
        // fora do Brasil não serve
        if (lat < -34 || lat > 6 || lng < -74.5 || lng > -34) return null;
        return { lat: lat, lng: lng };
      })
      .catch(function () { return null; });
  }

  window.GeoBR = {
    LIMITES: [[-34.0, -74.0], [5.5, -34.5]],   // Brasil inteiro
    CENTRO: [-15.0, -52.0],
    daCidade: daCidade,
    daUf: daUf,
    pontoDaEpo: pontoDaEpo,
    espalhar: espalhar,
    geocodificar: geocodificar
  };
})();
