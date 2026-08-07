/* =========================================================================
   Cronograma por planilha.

   Uma aba so, chamada Cronograma, com as colunas que a operacao ja usa. O
   modelo baixa preenchido com o cronograma atual: serve de exportacao e
   evita que alguem redigite codigo de fornecedor.

   window.PlanilhaCronograma.baixarModelo(unidades, ciclo)
   window.PlanilhaCronograma.ler(arquivo)   -> Promise { aba, linhas, erros, avisos, total }
   window.PlanilhaCronograma.pronta()

   A leitura acontece no proprio navegador. Nada e gravado aqui: quem chama
   mostra a previa e so entao decide.
   ========================================================================= */
(function () {
  "use strict";

  // O leitor de planilha mora aqui dentro, e nao num CDN.
  //
  // Vinha de cdn.sheetjs.com, endereco que a CSP das telas nao libera - entao a
  // importacao de planilha estava recusada pelo navegador em producao. Podia-se
  // acrescentar mais um endereco a lista de script permitido; guardar o arquivo
  // junto e melhor: uma origem a menos de onde pode vir codigo executavel, e a
  // importacao deixa de depender de um servico de terceiro estar no ar.
  var CDN = "assets/xlsx.full.min.js?v=135";
  var LIMITE_LINHAS = 2000;
  var ANO_MIN = 2020;
  var ANO_MAX = 2035;

  var UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
             "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

  // Quem preenche renomeia cabecalho, escreve com acento, sem acento,
  // maiuscula: tudo isso tem que continuar funcionando.
  // As colunas do CADASTRO da unidade. Valem nas duas planilhas: a do cadastro
  // (tela de EPOs) e a do cronograma, que e esta mais as colunas de data.
  var COLUNAS_EPO = [
    { campo: "cod",        rotulo: "Cod. Fornecedor", larg: 16,
      nomes: ["cod. forn.", "cod forn", "codigo fornecedor", "cod fornecedor",
              "codigo do fornecedor", "codigo", "cod", "fornecedor"] },
    { campo: "base",       rotulo: "Base", larg: 12,
      nomes: ["base", "base_epo", "unidade base"] },
    { campo: "nome",       rotulo: "Nome da EPO", larg: 40,
      nomes: ["nome_epo", "nome epo", "nome da epo", "nome da unidade",
              "razao social", "unidade", "nome", "epo"] },
    { campo: "cidade",     rotulo: "Cidade", larg: 22,
      nomes: ["cidade_epo", "cidade epo", "cidade", "municipio"] },
    { campo: "uf",         rotulo: "UF", larg: 6,
      nomes: ["uf_epo", "uf", "estado"] },
    { campo: "endereco",   rotulo: "Endereco", larg: 42,
      nomes: ["endereco_epo", "endereco", "logradouro"] },
    { campo: "cep",        rotulo: "CEP", larg: 12,
      nomes: ["cep"] },
    // Responsavel da unidade. A coluna do e-mail aceita mais de um, separados
    // por ponto e virgula: uma unidade pode ter mais de um responsavel, e todos
    // recebem o acesso. O nome da coluna ao lado e do primeiro da lista.
    { campo: "responsavel_nome",  rotulo: "Responsavel", larg: 26,
      nomes: ["responsavel", "responsavel da epo", "nome do responsavel",
              "contato", "nome do contato"] },
    { campo: "responsavel_email", rotulo: "E-mail do responsavel", larg: 38,
      nomes: ["e-mail do responsavel", "email do responsavel", "e-mails",
              "emails", "e-mail", "email", "e-mail de contato"] }
  ];

  var COLUNAS_DATA = [
    { campo: "data",       rotulo: "Data prevista", larg: 15,
      nomes: ["data prevista", "inicio previsto", "data da visita", "previsto",
              "inicio", "visita", "data"] },
    { campo: "ate",        rotulo: "Ate", larg: 13,
      nomes: ["ate", "fim previsto", "data fim", "termino", "fim"] },
    { campo: "semana",     rotulo: "Semana", larg: 20,
      nomes: ["semana prevista", "semana de referencia", "semana", "periodo"] },
    { campo: "observacao", rotulo: "Observacao", larg: 34,
      nomes: ["observacoes", "observacao", "obs", "nota"] }
  ];

  var COLUNAS_CRONOGRAMA = COLUNAS_EPO.concat(COLUNAS_DATA);

  // Qual conjunto usar. "epos" = so cadastro; qualquer outra coisa = cronograma,
  // que e o que as chamadas antigas esperavam.
  function colunasDe(modo) {
    return modo === "epos" ? COLUNAS_EPO : COLUNAS_CRONOGRAMA;
  }

  // Compatibilidade com quem ja chamava sem escolher o conjunto.
  var COLUNAS = COLUNAS_CRONOGRAMA;

  // --------------------------------------------------------------- biblioteca
  var promessaLib = null;

  function carregar() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (promessaLib) return promessaLib;
    promessaLib = new Promise(function (ok, falhou) {
      var tag = document.createElement("script");
      tag.src = CDN;
      tag.async = true;
      tag.onload = function () {
        if (window.XLSX) ok(window.XLSX);
        else falhou(new Error("O leitor de planilha nao carregou. Tente de novo em alguns instantes."));
      };
      tag.onerror = function () {
        promessaLib = null;   // sem isso, a segunda tentativa devolve a falha antiga
        falhou(new Error("O leitor de planilha nao carregou. Tente de novo em alguns instantes."));
      };
      document.head.appendChild(tag);
    });
    return promessaLib;
  }

  function pronta() { return !!window.XLSX; }

  // ----------------------------------------------------------------- helpers
  function normalizar(texto) {
    return String(texto == null ? "" : texto)
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function texto(v) {
    return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  }

  function codigoLimpo(v) {
    return String(v == null ? "" : v).toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function qualColuna(cabecalho, aceitos) {
    var i, j, nome;
    for (i = 0; i < cabecalho.length; i++) {
      nome = normalizar(cabecalho[i]);
      if (!nome) continue;
      for (j = 0; j < aceitos.length; j++) {
        if (nome === aceitos[j]) return i;
      }
    }
    // segunda passada, mais tolerante: aceita cabecalho com texto extra
    for (i = 0; i < cabecalho.length; i++) {
      nome = normalizar(cabecalho[i]);
      if (!nome) continue;
      for (j = 0; j < aceitos.length; j++) {
        if (nome.indexOf(aceitos[j]) >= 0) return i;
      }
    }
    return -1;
  }

  // ------------------------------------------------------------------- datas
  // O Excel guarda data como numero de dias desde 30/12/1899. A conta e feita
  // em UTC de proposito: com fuso local, uma planilha gerada em outro pais
  // chega como o dia anterior as 21h e o cronograma inteiro anda um dia.
  function daSerie(n) {
    if (!(n > 0)) return null;
    var d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }

  function diaExiste(a, m, d) {
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    var dt = new Date(Date.UTC(a, m - 1, d));
    return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  // Devolve { iso: "aaaa-mm-dd" } ou { erro: "motivo" } ou null quando vazio.
  function lerData(bruto) {
    if (bruto === "" || bruto === null || bruto === undefined) return null;

    if (typeof bruto === "number") {
      var iso = daSerie(bruto);
      return iso ? conferirFaixa(iso, bruto) : { erro: "data " + bruto + " nao existe" };
    }

    // Objeto Date so aparece se alguem ligar cellDates; lido campo a campo,
    // nunca por toISOString, que converteria para UTC e mudaria o dia.
    if (bruto instanceof Date && !isNaN(bruto.getTime())) {
      return conferirFaixa(
        bruto.getFullYear() + "-" + pad(bruto.getMonth() + 1) + "-" + pad(bruto.getDate()),
        bruto);
    }

    var t = texto(bruto);
    if (!t) return null;

    var m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
    if (m) {
      var dia = Number(m[1]), mes = Number(m[2]), ano = Number(m[3]);
      if (ano < 100) ano = 2000 + ano;
      if (!diaExiste(ano, mes, dia)) return { erro: "data " + t + " nao existe" };
      return conferirFaixa(ano + "-" + pad(mes) + "-" + pad(dia), t);
    }

    m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      var a2 = Number(m[1]), m2 = Number(m[2]), d2 = Number(m[3]);
      if (!diaExiste(a2, m2, d2)) return { erro: "data " + t + " nao existe" };
      return conferirFaixa(a2 + "-" + pad(m2) + "-" + pad(d2), t);
    }

    // Numero que veio como texto ("45870")
    if (/^\d+$/.test(t)) {
      var iso2 = daSerie(Number(t));
      if (iso2) return conferirFaixa(iso2, t);
    }

    return { erro: 'nao entendi a data "' + t + '". Use dia/mes/ano' };
  }

  function conferirFaixa(iso, original) {
    var ano = Number(iso.slice(0, 4));
    if (ano < ANO_MIN || ano > ANO_MAX) {
      return { erro: 'a data "' + original + '" caiu no ano ' + ano + ', que nao parece certo' };
    }
    return { iso: iso };
  }

  function paraBrasil(iso) {
    if (!iso) return "";
    var p = String(iso).slice(0, 10).split("-");
    if (p.length !== 3) return "";
    return p[2] + "/" + p[1] + "/" + p[0];
  }

  // ------------------------------------------------------------------ modelo
  // Baixa preenchido com o que ja esta no cronograma: quem recebe o arquivo
  // corrige o que precisa em vez de digitar 25 codigos de novo.
  // Um valor por coluna, na ordem do conjunto escolhido: assim acrescentar
  // coluna no cabecalho nao pede mexer aqui, e cabecalho e conteudo nao saem
  // desalinhados (era o que aconteceria montando a linha a mao).
  function valorDaColuna(u, campo) {
    if (campo === "data") return paraBrasil(u.prevIniIso);
    if (campo === "ate")  return paraBrasil(u.prevFimIso);
    if (campo === "responsavel_nome")  return texto(u.responsavelNome);
    if (campo === "responsavel_email") return texto(u.responsavelEmails);
    return texto(u[campo]);
  }

  function baixarModelo(unidades, ciclo, modo) {
    return carregar().then(function (XLSX) {
      var colunas = colunasDe(modo);
      var soCadastro = modo === "epos";
      var linhas = [colunas.map(function (c) { return c.rotulo; })];
      var lista = (unidades || []).slice();

      lista.sort(function (a, b) {
        var ra = texto(a.uf), rb = texto(b.uf);
        if (ra !== rb) return ra < rb ? -1 : 1;
        return texto(a.nome).localeCompare(texto(b.nome), "pt-BR");
      });

      lista.forEach(function (u) {
        linhas.push(colunas.map(function (c) { return valorDaColuna(u, c.campo); }));
      });

      // Cadastro vazio: a linha de exemplo e visivelmente um exemplo. Exemplo
      // com dado plausivel volta preenchido e vira registro falso.
      if (!lista.length) {
        linhas.push(colunas.map(function (c) {
          if (c.campo === "cod") return "EXEMPLO - apague esta linha";
          if (c.campo === "nome") return "Nome da unidade";
          if (c.campo === "cidade") return "Cidade";
          if (c.campo === "uf") return "SP";
          if (c.campo === "responsavel_nome") return "Nome de quem responde";
          if (c.campo === "responsavel_email") return "primeiro@epo.com.br; segundo@epo.com.br";
          if (c.campo === "data") return "12/08/2026";
          return "";
        }));
      }

      var aba = XLSX.utils.aoa_to_sheet(linhas);
      aba["!cols"] = colunas.map(function (c) { return { wch: c.larg }; });
      aba["!freeze"] = { xSplit: 0, ySplit: 1 };

      var livro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(livro, aba, soCadastro ? "Unidades" : "Cronograma");
      XLSX.writeFile(livro, soCadastro
        ? "unidades-epo.xlsx"
        : "cronograma-auditorias-" + (ciclo || "") + ".xlsx");
      return true;
    });
  }

  // ----------------------------------------------------------------- leitura
  function ler(arquivo, modo) {
    return carregar().then(function (XLSX) {
      return new Promise(function (ok, falhou) {
        var leitor = new FileReader();
        leitor.onerror = function () { falhou(new Error("Nao foi possivel abrir o arquivo.")); };
        leitor.onload = function (ev) {
          try { ok(interpretar(XLSX, ev.target.result, modo)); }
          catch (e) { falhou(e); }
        };
        leitor.readAsArrayBuffer(arquivo);
      });
    });
  }

  function interpretar(XLSX, buffer, modo) {
    // Sem cellDates de proposito: com ele a celula vira Date no fuso local e
    // a data anda um dia. O numero de serie e convertido em UTC por lerData.
    var livro = XLSX.read(new Uint8Array(buffer), { type: "array" });
    var nomes = livro.SheetNames || [];
    if (!nomes.length) throw new Error("A planilha esta vazia.");

    // Aba preferida: "Cronograma" na planilha de datas, "Unidades" na de
    // cadastro. Sem nenhuma delas, vale a primeira aba do arquivo.
    var procurar = modo === "epos" ? ["unidade", "epo"] : ["cronograma"];
    var alvo = null, i, j;
    for (i = 0; i < nomes.length && !alvo; i++) {
      for (j = 0; j < procurar.length; j++) {
        if (normalizar(nomes[i]).indexOf(procurar[j]) >= 0) { alvo = nomes[i]; break; }
      }
    }
    var abaEsperada = !!alvo;
    if (!alvo) alvo = nomes[0];

    // blankrows mantem a linha vazia no array: sem isso o numero da linha do
    // aviso nao bate com o do Excel e quem for procurar olha a linha errada.
    var grade = XLSX.utils.sheet_to_json(livro.Sheets[alvo], {
      header: 1, blankrows: true, defval: ""
    });
    if (!grade.length) throw new Error('A aba "' + alvo + '" esta vazia.');

    // O cabecalho pode nao estar na primeira linha: gente poe titulo em cima.
    var iCab = -1, mapa = null, l, tentativa;
    for (l = 0; l < Math.min(grade.length, 10); l++) {
      tentativa = mapearColunas(grade[l] || [], modo);
      if (tentativa && tentativa.cod >= 0) { iCab = l; mapa = tentativa; break; }
    }
    if (iCab < 0) {
      throw new Error('Nao achei a coluna "Cod. Fornecedor" na planilha. ' +
                      "Baixe o modelo e preencha nele.");
    }

    if (grade.length - iCab - 1 > LIMITE_LINHAS) {
      throw new Error("A planilha tem mais linhas do que o previsto. " +
                      "Envie no maximo " + LIMITE_LINHAS + " unidades por vez.");
    }

    var linhas = [], erros = [], avisos = [];
    var porChave = {};        // codigo + base -> [indices em linhas]
    var vistas = {};          // linha inteira repetida
    var repetidasIguais = 0;
    var lidas = 0;            // linhas com conteudo, boas ou ruins
    var r, bruta, item;

    for (r = iCab + 1; r < grade.length; r++) {
      bruta = grade[r] || [];
      var antes = erros.length;
      item = lerLinha(bruta, mapa, r + 1, erros);
      if (!item) {
        if (erros.length > antes) lidas += 1;   // recusada, mas foi lida
        continue;
      }
      lidas += 1;

      // JSON em vez de juntar com separador: qualquer separador escolhido
      // pode aparecer dentro de um campo e fundir duas linhas diferentes.
      var assinatura = JSON.stringify([item.cod, item.base, item.nome,
                                       item.cidade, item.uf, item.data, item.ate]);
      if (vistas[assinatura]) { repetidasIguais += 1; continue; }
      vistas[assinatura] = true;

      var chave = item.cod + "|" + item.base;
      if (!porChave[chave]) porChave[chave] = [];
      porChave[chave].push(linhas.length);
      linhas.push(item);
    }

    // Codigo repetido derruba TODAS as linhas daquele codigo, nao so a
    // segunda: escolher em silencio qual vale esconde um erro de digitacao
    // que vira unidade errada no cadastro. Mesmo codigo com bases diferentes
    // sao unidades diferentes e entram as duas.
    var fora = {};
    Object.keys(porChave).forEach(function (chave) {
      var idx = porChave[chave];
      if (idx.length < 2) return;
      var numeros = idx.map(function (k) { return linhas[k].linha; });
      idx.forEach(function (k) {
        fora[k] = true;
        erros.push({
          linha: linhas[k].linha,
          motivo: "codigo " + linhas[k].cod + " repetido, tambem " +
                  (numeros.length > 2 ? "nas linhas " : "na linha ") +
                  numeros.filter(function (n) { return n !== linhas[k].linha; }).join(", ") +
                  ". Corrija a planilha e envie de novo"
        });
      });
    });

    var validas = linhas.filter(function (_, k) { return !fora[k]; });

    if (repetidasIguais) {
      avisos.push({ linha: 0, motivo: repetidasIguais +
        (repetidasIguais === 1 ? " linha repetida igual foi contada uma vez"
                               : " linhas repetidas iguais foram contadas uma vez") });
    }

    erros.sort(function (a, b) { return a.linha - b.linha; });

    return {
      aba: alvo,
      abaEsperada: abaEsperada,
      linhas: validas,
      erros: erros,
      avisos: avisos,
      // Linha repetida entra em linhas E em erros: somar os dois contaria
      // duas vezes e a previa diria mais linhas do que a planilha tem.
      total: lidas
    };
  }

  function mapearColunas(cabecalho, modo) {
    var mapa = {};
    // Sempre procura TODAS as colunas conhecidas, mesmo no modo cadastro: se a
    // pessoa mandar a planilha do cronograma na tela de EPOs, as datas sao
    // simplesmente ignoradas em vez de a leitura reclamar de coluna a mais.
    COLUNAS_CRONOGRAMA.forEach(function (c) {
      mapa[c.campo] = qualColuna(cabecalho, c.nomes);
    });
    mapa._modo = modo === "epos" ? "epos" : "cronograma";
    return mapa;
  }

  function pegar(bruta, mapa, campo) {
    var i = mapa[campo];
    return i >= 0 ? bruta[i] : "";
  }

  function lerLinha(bruta, mapa, numero, erros) {
    var cod = codigoLimpo(pegar(bruta, mapa, "cod"));
    var nome = texto(pegar(bruta, mapa, "nome"));
    var cidade = texto(pegar(bruta, mapa, "cidade"));
    var uf = texto(pegar(bruta, mapa, "uf")).toUpperCase();

    var temAlgo = cod || nome || cidade || uf ||
      texto(pegar(bruta, mapa, "endereco")) || texto(pegar(bruta, mapa, "data")) ||
      texto(pegar(bruta, mapa, "responsavel_email"));
    if (!temAlgo) return null;                       // linha em branco

    if (/^EXEMPLO/.test(String(pegar(bruta, mapa, "cod")).toUpperCase())) return null;

    if (!cod) {
      erros.push({ linha: numero, motivo: "sem codigo do fornecedor" });
      return null;
    }
    if (uf && UFS.indexOf(uf) < 0) {
      erros.push({ linha: numero, motivo: 'a sigla "' + uf + '" nao e um estado' });
      return null;
    }

    var dIni = lerData(pegar(bruta, mapa, "data"));
    if (dIni && dIni.erro) {
      erros.push({ linha: numero, motivo: dIni.erro });
      return null;
    }
    var dFim = lerData(pegar(bruta, mapa, "ate"));
    if (dFim && dFim.erro) {
      erros.push({ linha: numero, motivo: dFim.erro });
      return null;
    }
    if (dIni && dFim && dFim.iso < dIni.iso) {
      erros.push({ linha: numero, motivo: "a data final e anterior a inicial" });
      return null;
    }
    if (!dIni && dFim) {
      erros.push({ linha: numero, motivo: 'tem data em "Ate" mas nao tem data prevista' });
      return null;
    }

    // E-mail do responsavel: a celula aceita mais de um. Aqui so se confere o
    // formato para avisar quem escreveu errado - quem separa e grava e o banco,
    // que e o mesmo caminho da tela.
    var emails = texto(pegar(bruta, mapa, "responsavel_email"));
    if (emails) {
      var ruins = [];
      emails.split(/[;,]+/).forEach(function (parte) {
        var e = String(parte).replace(/^[^<]*</, "").replace(/>/g, "").trim();
        if (!e) return;
        if (!/^\S+@\S+\.\S+$/.test(e)) ruins.push(e);
      });
      if (ruins.length) {
        erros.push({ linha: numero, codigo: cod,
                     motivo: "e-mail que nao parece valido: " + ruins.join(", ") });
        return null;
      }
    }

    return {
      linha: numero,
      cod: cod,
      base: texto(pegar(bruta, mapa, "base")).toUpperCase(),
      nome: nome,
      cidade: cidade,
      uf: uf,
      endereco: texto(pegar(bruta, mapa, "endereco")),
      cep: texto(pegar(bruta, mapa, "cep")),
      responsavel_nome: texto(pegar(bruta, mapa, "responsavel_nome")),
      responsavel_email: emails,
      data: dIni ? dIni.iso : "",
      ate: dFim ? dFim.iso : "",
      semana: texto(pegar(bruta, mapa, "semana")),
      observacao: texto(pegar(bruta, mapa, "observacao")),
      ativo: true
    };
  }

  window.PlanilhaCronograma = {
    baixarModelo: baixarModelo,
    ler: ler,
    pronta: pronta,
    carregar: carregar,
    codigoLimpo: codigoLimpo,
    paraBrasil: paraBrasil
  };
})();
