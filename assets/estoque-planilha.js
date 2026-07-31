/* =========================================================================
   Levantamento de estoque por planilha.

   Contar item por item na tela serve para conferência pontual. Para um
   levantamento inteiro, ninguém digita 300 códigos: preenche a planilha e
   sobe. Este arquivo cuida das duas pontas disso.

   window.Planilha.baixarModelo()      -> gera e baixa o modelo .xlsx
   window.Planilha.ler(arquivo)        -> Promise com { itens, erros, resumo }
   window.Planilha.pronta()            -> a biblioteca de leitura carregou?

   A leitura acontece no próprio navegador: o arquivo só sai da máquina depois
   que a pessoa confere o que foi reconhecido.
   ========================================================================= */
(function () {
  "use strict";

  var CDN = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";

  // Nome das colunas aceitas. Quem preenche renomeia cabeçalho, escreve com
  // acento, sem acento, maiúscula: tudo isso tem que continuar funcionando.
  var COLUNA_CODIGO = ["codigo sap", "codigo", "cod", "cod sap", "sap", "material", "codigo do item"];
  var COLUNA_QTD = ["quantidade", "qtd", "qtde", "quant", "qtd recebida", "quantidade recebida"];
  var COLUNA_OBS = ["observacao", "observacoes", "obs", "nota"];

  var LIMITE_LINHAS = 5000;

  // ----------------------------------------------------------- biblioteca
  var promessaLib = null;

  function carregarLib() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (promessaLib) return promessaLib;
    promessaLib = new Promise(function (ok, falhou) {
      var tag = document.createElement("script");
      tag.src = CDN;
      tag.async = true;
      tag.onload = function () {
        if (window.XLSX) ok(window.XLSX);
        else falhou(new Error("leitor de planilha não inicializou"));
      };
      tag.onerror = function () { falhou(new Error("leitor de planilha não carregou")); };
      document.head.appendChild(tag);
    });
    return promessaLib;
  }

  function pronta() { return !!window.XLSX; }

  // -------------------------------------------------------------- helpers
  function normalizar(texto) {
    return String(texto == null ? "" : texto)
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function soDigitos(v) {
    return String(v == null ? "" : v).replace(/[^0-9]/g, "");
  }

  function inteiro(v) {
    if (typeof v === "number") return Math.max(0, Math.round(v));
    var limpo = String(v == null ? "" : v).replace(/\./g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
    var n = parseFloat(limpo);
    return isFinite(n) && n > 0 ? Math.round(n) : 0;
  }

  function catalogo() {
    return window.CATALOGO_GIRO || [];
  }

  // Índice por código, para casar a planilha com o catálogo da Claro
  var porCodigo = null;
  function indice() {
    if (porCodigo) return porCodigo;
    porCodigo = {};
    catalogo().forEach(function (it) {
      porCodigo[soDigitos(it.cod)] = it;
    });
    return porCodigo;
  }

  function qualColuna(cabecalho, aceitos) {
    for (var i = 0; i < cabecalho.length; i++) {
      var nome = normalizar(cabecalho[i]);
      if (!nome) continue;
      for (var j = 0; j < aceitos.length; j++) {
        if (nome === aceitos[j]) return i;
      }
    }
    // segunda passada, mais tolerante: aceita cabeçalho com texto extra
    for (var k = 0; k < cabecalho.length; k++) {
      var n2 = normalizar(cabecalho[k]);
      for (var m = 0; m < aceitos.length; m++) {
        if (n2 && n2.indexOf(aceitos[m]) >= 0) return k;
      }
    }
    return -1;
  }

  // --------------------------------------------------------------- modelo
  function baixarModelo(nomeEpo) {
    return carregarLib().then(function (XLSX) {
      var livro = XLSX.utils.book_new();

      // Aba de preenchimento: duas colunas obrigatórias e uma opcional.
      var preencher = [
        ["Código SAP", "Quantidade", "Observação"],
        ["41001094", 12, ""],
        ["22026293", 4, "fonte avulsa"],
        ["", "", ""]
      ];
      var abaPreencher = XLSX.utils.aoa_to_sheet(preencher);
      abaPreencher["!cols"] = [{ wch: 16 }, { wch: 12 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(livro, abaPreencher, "Contagem");

      // Aba de apoio com o catálogo, para quem preenche não precisar decorar
      // código nenhum: filtra, copia e cola.
      var apoio = [["Código SAP", "Tecnologia", "Tipo", "Categoria", "Giro"]];
      catalogo().forEach(function (it) {
        apoio.push([it.cod, it.tec || "", it.tipo || "", it.cat || "", it.giro === "alto" ? "Alto giro" : "Baixo giro"]);
      });
      var abaApoio = XLSX.utils.aoa_to_sheet(apoio);
      abaApoio["!cols"] = [{ wch: 14 }, { wch: 26 }, { wch: 14 }, { wch: 22 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(livro, abaApoio, "Itens disponíveis");

      var nome = "levantamento-de-estoque";
      if (nomeEpo) {
        nome += "-" + normalizar(nomeEpo).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      }
      XLSX.writeFile(livro, nome + ".xlsx");
      return true;
    });
  }

  // --------------------------------------------------------------- leitura
  // Devolve { itens, erros, resumo }. Nada é gravado aqui: quem chama mostra
  // o resultado e só então decide.
  function ler(arquivo) {
    return carregarLib().then(function (XLSX) {
      return new Promise(function (ok, falhou) {
        var leitor = new FileReader();
        leitor.onerror = function () { falhou(new Error("não foi possível abrir o arquivo")); };
        leitor.onload = function (ev) {
          try {
            ok(interpretar(XLSX, ev.target.result));
          } catch (e) {
            falhou(e);
          }
        };
        leitor.readAsArrayBuffer(arquivo);
      });
    });
  }

  function interpretar(XLSX, buffer) {
    var livro = XLSX.read(new Uint8Array(buffer), { type: "array" });
    var nomes = livro.SheetNames || [];
    if (!nomes.length) throw new Error("a planilha está vazia");

    // Prefere a aba "Contagem"; se o arquivo veio de outro lugar, usa a primeira
    var alvo = null;
    for (var i = 0; i < nomes.length; i++) {
      if (normalizar(nomes[i]).indexOf("contagem") >= 0) { alvo = nomes[i]; break; }
    }
    if (!alvo) alvo = nomes[0];

    var linhas = XLSX.utils.sheet_to_json(livro.Sheets[alvo], { header: 1, blankrows: false, defval: "" });
    if (!linhas.length) throw new Error('a aba "' + alvo + '" está vazia');

    // Acha o cabeçalho nas primeiras linhas: gente insere título acima da tabela
    var iCab = -1, cCod = -1, cQtd = -1, cObs = -1;
    for (var l = 0; l < Math.min(linhas.length, 10); l++) {
      var cab = linhas[l] || [];
      var c1 = qualColuna(cab, COLUNA_CODIGO);
      var c2 = qualColuna(cab, COLUNA_QTD);
      if (c1 >= 0 && c2 >= 0) {
        iCab = l; cCod = c1; cQtd = c2; cObs = qualColuna(cab, COLUNA_OBS);
        break;
      }
    }
    if (iCab < 0) {
      throw new Error('não achei as colunas "Código SAP" e "Quantidade" na planilha. Baixe o modelo e preencha nele');
    }

    var mapa = indice();
    var achados = {};   // codigo -> quantidade somada
    var erros = [];
    var lidas = 0, ignoradas = 0;

    for (var r = iCab + 1; r < linhas.length && lidas < LIMITE_LINHAS; r++) {
      var linha = linhas[r] || [];
      var cod = soDigitos(linha[cCod]);
      var bruto = linha[cQtd];

      if (!cod && !String(bruto || "").trim()) continue;   // linha em branco
      lidas += 1;

      if (!cod) {
        erros.push({ linha: r + 1, motivo: "sem código SAP" });
        continue;
      }
      if (!mapa[cod]) {
        erros.push({ linha: r + 1, codigo: cod, motivo: "código fora do catálogo" });
        continue;
      }
      var qtd = inteiro(bruto);
      if (!qtd) {
        erros.push({ linha: r + 1, codigo: cod, motivo: "quantidade inválida ou zerada" });
        continue;
      }
      if (achados[cod]) ignoradas += 1;   // código repetido: soma
      achados[cod] = (achados[cod] || 0) + qtd;
    }

    var itens = Object.keys(achados).map(function (cod) {
      var it = mapa[cod];
      return {
        cod: it.cod, tec: it.tec, tipo: it.tipo, cat: it.cat, giro: it.giro,
        qtd: achados[cod]
      };
    });

    var total = 0, alto = 0;
    itens.forEach(function (it) {
      total += it.qtd;
      if (it.giro === "alto") alto += it.qtd;
    });

    return {
      itens: itens,
      erros: erros,
      resumo: {
        aba: alvo,
        linhasLidas: lidas,
        reconhecidos: itens.length,
        repetidosSomados: ignoradas,
        total: total,
        alto: alto,
        baixo: total - alto
      }
    };
  }

  window.Planilha = {
    baixarModelo: baixarModelo,
    ler: ler,
    pronta: pronta,
    carregar: carregarLib
  };
})();
