/* =========================================================================
   Formulario da unidade (EPO), um so para as duas telas.

   A tela de EPOs e a tela de Cronograma tinham cada uma o seu formulario de
   cadastro, com perguntas diferentes:

     - em EPOs faltavam codigo do fornecedor, base, data final e semana de
       referencia;
     - no Cronograma faltavam situacao, questionarios, e-mail do responsavel
       e a coordenada do endereco.

   Pior que a diferenca de campos: a unidade cadastrada na tela de EPOs NAO
   entrava no cronograma. O cronograma lista linhas de cronograma_itens, e a
   tela de EPOs nunca criava uma. Quem cadastrava por ali ficava procurando a
   unidade no roadmap e nao achava.

   Aqui as perguntas sao escritas uma vez e o gravar e um so, para as duas
   telas nao voltarem a divergir. Toda unidade cadastrada em qualquer uma das
   telas entra no cadastro E no ciclo do cronograma.

   Uso:
     document.getElementById("...").innerHTML = FormEpo.colunas({ escolha: true });
     FormEpo.preparar({ processos: ..., pedidos: ... });
     FormEpo.preencher(epo);
     var d = FormEpo.ler();
     var erro = FormEpo.validar(d, editandoId);
     FormEpo.salvarTudo({ db: Auth.cliente, dados: d, epoId: editandoId, ... })

   Nada aqui abre ou fecha janela: cada tela cuida da sua, porque o titulo, o
   botao e o que acontece depois de salvar mudam de tela para tela.
   ========================================================================= */
(function () {
  "use strict";

  var UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
             "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

  function esc(s) {
    return (window.App && App.escapeHtml) ? App.escapeHtml(s) : String(s == null ? "" : s);
  }
  function $(id) { return document.getElementById(id); }
  function val(id) { var e = $(id); return e ? e.value : ""; }
  function txt(id) { return String(val(id) || "").trim(); }

  // Estado do formulario. Vive aqui porque as duas telas usam os mesmos
  // campos: guardar na tela faria uma delas esquecer de atualizar.
  var processos = [];
  var pedidos = [];
  var papel = "";

  // ---------------------------------------------------------------- markup
  function opcoesUf(vazia) {
    var out = vazia ? '<option value="">' + esc(vazia) + "</option>" : "";
    return out + UFS.map(function (u) {
      return '<option value="' + u + '">' + u + "</option>";
    }).join("");
  }

  /* opts:
       escolha  - mostra o seletor de EPO (modo "nova auditoria" da tela de EPOs)
       agenda   - mostra a coluna de questionarios e datas (padrao: true)
  */
  function colunas(opts) {
    var o = opts || {};
    var comEscolha = !!o.escolha;
    var comAgenda = o.agenda !== false;

    var col1 =
      '<div class="modal-col">' +
        '<p class="col-titulo"><i class="ti ti-building-warehouse" aria-hidden="true"></i>' +
          "Dados da unidade</p>" +
        '<div class="field' + (comEscolha ? "" : " is-hidden") + '" id="f-escolha-wrap">' +
          '<label for="f-escolha">EPO</label>' +
          '<select class="select" id="f-escolha"></select>' +
          '<span class="hint">Escolha a unidade para ver os dados e marcar os questionários.</span>' +
        "</div>" +
        '<div class="field-row">' +
          '<div class="field">' +
            '<label for="f-cod">Cód. do fornecedor</label>' +
            '<input class="input" id="f-cod" type="text" autocomplete="off" placeholder="Ex.: 143620">' +
            '<span class="hint">É o que separa unidades de mesmo nome. Sem ele, reenviar a planilha duplica o cadastro.</span>' +
          "</div>" +
          '<div class="field base">' +
            '<label for="f-base">Base</label>' +
            '<input class="input" id="f-base" type="text" autocomplete="off" placeholder="única">' +
            '<span class="hint">Só se o mesmo código tiver mais de uma.</span>' +
          "</div>" +
        "</div>" +
        '<div class="field">' +
          '<label for="f-nome">Nome da EPO</label>' +
          '<input class="input" id="f-nome" type="text" placeholder="razão social" autocomplete="off">' +
        "</div>" +
        '<div class="field">' +
          '<label for="f-ativo">Situação</label>' +
          '<select class="select" id="f-ativo">' +
            '<option value="1" selected>Ativa</option>' +
            '<option value="0">Inativa</option>' +
          "</select>" +
          '<span class="hint">EPO inativa sai do mapa e das listas, mas o histórico dela fica guardado.</span>' +
        "</div>" +
      "</div>";

    var col2 =
      '<div class="modal-col">' +
        '<p class="col-titulo"><i class="ti ti-map-pin" aria-hidden="true"></i>Localização</p>' +
        // O CEP vem primeiro porque ele preenche o resto: oito numeros erram
        // menos que rua, cidade e sigla digitadas a mao.
        '<div class="field">' +
          '<label for="f-cep">CEP</label>' +
          '<input class="input" id="f-cep" type="text" inputmode="numeric" placeholder="00000-000" autocomplete="off" maxlength="9">' +
          '<span class="hint" id="f-cep-aviso">Preenche endereço, cidade e UF.</span>' +
        "</div>" +
        '<div class="field">' +
          '<label for="f-endereco">Endereço</label>' +
          '<input class="input" id="f-endereco" type="text" placeholder="rua, número, complemento" autocomplete="off">' +
        "</div>" +
        '<div class="field-row">' +
          '<div class="field">' +
            '<label for="f-cidade">Cidade</label>' +
            '<input class="input" id="f-cidade" type="text" placeholder="Ex.: Campinas" autocomplete="off">' +
          "</div>" +
          '<div class="field uf">' +
            '<label for="f-uf">UF</label>' +
            '<select class="select" id="f-uf">' + opcoesUf(null) + "</select>" +
          "</div>" +
        "</div>" +
        '<div class="nota-modal">' +
          '<i class="ti ti-map-pin" aria-hidden="true"></i>' +
          "<span>Com o endereço preenchido a EPO cai no ponto exato do mapa. " +
          "Só com cidade e UF ela aparece em posição aproximada.</span>" +
        "</div>" +
      "</div>";

    if (!comAgenda) return '<div class="modal-cols">' + col1 + col2 + "</div>";

    var col3 =
      '<div class="modal-col">' +
        '<p class="col-titulo"><i class="ti ti-clipboard-list" aria-hidden="true"></i>' +
          "Questionários e visita</p>" +
        // Uma unidade pode ter mais de um responsavel: todos recebem o acesso e
        // todos veem a unidade. Antes havia um par de campos so, e o segundo
        // contato nao tinha por onde entrar.
        '<div class="field">' +
          '<label>Responsáveis da EPO</label>' +
          '<div id="f-resps"></div>' +
          '<button class="btn btn-ghost btn-sm" type="button" id="f-resp-add">' +
            '<i class="ti ti-plus" aria-hidden="true"></i>Adicionar responsável</button>' +
          '<span class="hint">Cada um recebe um aviso de acesso e entra com esse e-mail: ' +
            'na tela de entrada pede um código, que chega no próprio e-mail.</span>' +
        "</div>" +
        '<div class="field">' +
          '<div class="procs-head">' +
            '<span class="procs-rotulo">Questionários desta EPO</span>' +
            '<span class="procs-count" id="f-procs-count"></span>' +
          "</div>" +
          '<div class="procs-box" id="f-procs"></div>' +
          '<button class="link-mini" id="f-procs-toggle" type="button" style="align-self:flex-start;">Marcar todos</button>' +
        "</div>" +
        '<div class="field-row">' +
          '<div class="field">' +
            '<label for="f-visita">Visita prevista</label>' +
            '<input class="input" id="f-visita" type="date" min="2020-01-01" max="2035-12-31">' +
          "</div>" +
          '<div class="field">' +
            '<label for="f-ate">Até</label>' +
            '<input class="input" id="f-ate" type="date" min="2020-01-01" max="2035-12-31">' +
            '<span class="hint">Só se durar mais de um dia.</span>' +
          "</div>" +
        "</div>" +
        '<div class="field">' +
          '<label for="f-semana">Semana de referência</label>' +
          '<input class="input" id="f-semana" type="text" autocomplete="off" placeholder="Ex.: 3a semana de julho">' +
          '<span class="hint">Texto livre, para quando a data ainda não está fechada.</span>' +
        "</div>" +
        '<div class="field" style="margin-bottom:4px;">' +
          '<label for="f-obs">Observação</label>' +
          '<textarea class="textarea" id="f-obs" rows="2" style="min-height:62px;" placeholder="Ex.: priorizar notas fiscais dos últimos 30 dias"></textarea>' +
        "</div>" +
        '<div class="nota-modal">' +
          '<i class="ti ti-calendar-event" aria-hidden="true"></i>' +
          "<span>A unidade entra no cadastro e no cronograma do ciclo. A data fica guardada " +
          "e não vai para a Claro agora: a coordenação confere a lista e envia depois. " +
          "Cada questionário marcado fica pendente para o responsável, e questionário já " +
          "pedido continua pendente, sem duplicar.</span>" +
        "</div>" +
      "</div>";

    return '<div class="modal-cols tres">' + col1 + col2 + col3 + "</div>";
  }

  function setVal(id, v) { var e = $(id); if (e) e.value = v == null ? "" : v; }

  // -------------------------------------------------------------- preparar
  function preparar(opts) {
    var o = opts || {};
    processos = o.processos || [];
    pedidos = o.pedidos || [];
    papel = o.papel || papel;

    var cep = $("f-cep");
    if (cep && !cep.getAttribute("data-mascara")) {
      cep.setAttribute("data-mascara", "1");
      cep.addEventListener("input", function () {
        var d = this.value.replace(/\D/g, "").slice(0, 8);
        this.value = d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d;
        // Oito numeros digitados: busca sozinho, sem esperar sair do campo.
        if (d.length === 8) buscarCep();
      });
      cep.addEventListener("blur", buscarCep);
    }

    ligarResps();

    var box = $("f-procs");
    if (box && !box.getAttribute("data-ligado")) {
      box.setAttribute("data-ligado", "1");
      box.addEventListener("change", resumoProcs);
    }
    var tg = $("f-procs-toggle");
    if (tg && !tg.getAttribute("data-ligado")) {
      tg.setAttribute("data-ligado", "1");
      tg.addEventListener("click", function () {
        var livres = caixas().filter(function (c) { return !c.disabled; });
        var todos = marcados().length !== livres.length;
        livres.forEach(function (c) { c.checked = todos; });
        resumoProcs();
      });
    }
  }

  // Busca o endereco do CEP e preenche o que estiver vazio. NAO sobrescreve o
  // que a pessoa escreveu: quem digitou o endereco antes do CEP nao perde o
  // numero e o complemento, que sao justamente o que o CEP nao sabe.
  var cepBuscado = "";

  function buscarCep() {
    var campo = $("f-cep");
    var aviso = $("f-cep-aviso");
    if (!campo || !window.GeoBR || !GeoBR.porCep) return;
    var limpo = String(campo.value || "").replace(/\D/g, "");
    if (limpo.length !== 8 || limpo === cepBuscado) return;
    cepBuscado = limpo;
    if (aviso) aviso.textContent = "Procurando o endereço...";

    GeoBR.porCep(limpo).then(function (a) {
      if (!a) {
        if (aviso) aviso.textContent = "CEP não encontrado. Preencha o endereço à mão.";
        return;
      }
      var preenchidos = [];
      if (a.endereco && !txt("f-endereco")) {
        setVal("f-endereco", a.endereco);
        preenchidos.push("endereço");
      }
      if (a.cidade && !txt("f-cidade")) {
        setVal("f-cidade", a.cidade);
        preenchidos.push("cidade");
      }
      if (a.uf) {
        var uf = $("f-uf");
        // O seletor de UF nasce em SP: trocar por causa do CEP e o certo,
        // porque SP aqui e valor de partida, e nao escolha de ninguem.
        if (uf && (!uf.value || uf.value === "SP" || uf.value !== a.uf)) {
          setVal("f-uf", a.uf);
          preenchidos.push("UF");
        }
      }
      if (aviso) {
        aviso.textContent = preenchidos.length
          ? "Preenchido: " + preenchidos.join(", ") + ". Confira o número e o complemento."
          : "Endereço já preenchido: nada foi trocado.";
      }
    });
  }

  function atualizarListas(o) {
    if (o && o.processos) processos = o.processos;
    if (o && o.pedidos) pedidos = o.pedidos;
  }

  // ------------------------------------------------------- questionarios
  function procPorId(id) {
    for (var i = 0; i < processos.length; i++) {
      if (String(processos[i].id) === String(id)) return processos[i];
    }
    return null;
  }
  function nomeProc(id) {
    var p = procPorId(id);
    return p ? p.nome : "questionário";
  }
  function rotuloStatus(s) {
    if (s === "enviada") return "enviado";
    if (s === "em_andamento") return "em andamento";
    return "pendente";
  }
  function pedidosDaEpo(epoId) {
    var mapa = {};
    if (!epoId) return mapa;
    pedidos.forEach(function (a) {
      if (String(a.epoId) === String(epoId)) mapa[String(a.procId)] = a;
    });
    return mapa;
  }
  function caixas() {
    var box = $("f-procs");
    if (!box) return [];
    return Array.prototype.slice.call(box.querySelectorAll('input[type="checkbox"]'));
  }
  function marcados() {
    var out = [];
    caixas().forEach(function (c) { if (c.checked && !c.disabled) out.push(c.value); });
    return out;
  }
  function resumoProcs() {
    var livres = caixas().filter(function (c) { return !c.disabled; });
    var n = marcados().length;
    var jaN = caixas().length - livres.length;
    var alvo = $("f-procs-count");
    var toggle = $("f-procs-toggle");
    var partes = [];
    if (jaN) partes.push(jaN + (jaN === 1 ? " já pedido" : " já pedidos"));
    partes.push(n ? n + (n === 1 ? " novo marcado" : " novos marcados") : "nenhum novo marcado");
    if (alvo) alvo.textContent = partes.join(" · ");
    if (toggle) {
      toggle.style.display = livres.length ? "" : "none";
      toggle.textContent = (livres.length && n === livres.length) ? "Desmarcar todos" : "Marcar todos";
    }
  }
  function renderProcs(epoId) {
    var box = $("f-procs");
    if (!box) return;
    if (!processos.length) {
      box.innerHTML = '<div class="procs-vazio">Nenhum questionário disponível.</div>';
      resumoProcs();
      return;
    }
    var jaTem = pedidosDaEpo(epoId);
    box.innerHTML = processos.map(function (p, i) {
      var id = "f-proc-" + i;
      var pedido = jaTem[String(p.id)];
      return (
        '<label class="checkbox proc-opt' + (pedido ? " ja-pedido" : "") + '" for="' + id + '">' +
          '<input type="checkbox" id="' + id + '" value="' + esc(p.id) + '"' +
            (pedido ? " checked disabled" : "") + ">" +
          '<i class="ti ' + esc(p.icone || "ti-clipboard-list") + '" aria-hidden="true"></i>' +
          '<span class="nm">' + esc(p.nome) + "</span>" +
          (pedido ? '<span class="tag-pedido">' + esc(rotuloStatus(pedido.status)) + "</span>" : "") +
        "</label>"
      );
    }).join("");
    resumoProcs();
  }

  // ------------------------------------------------- lista de responsaveis
  // Uma linha por pessoa: nome, e-mail e o botao de tirar. A primeira linha e a
  // do responsavel principal - e o e-mail que assina o pedido de questionario.
  function htmlLinhaResp(i, nome, email) {
    return (
      '<div class="resp-linha" data-resp-linha="' + i + '">' +
        '<input class="input resp-nome" type="text" placeholder="nome de quem responde" ' +
          'aria-label="Nome do responsável" autocomplete="off" value="' + esc(nome || "") + '">' +
        '<input class="input resp-email" type="email" placeholder="nome@empresa.com.br" ' +
          'aria-label="E-mail do responsável" autocomplete="off" value="' + esc(email || "") + '">' +
        '<button class="btn btn-ghost btn-icon btn-sm resp-tirar" type="button" ' +
          'data-resp-tirar="' + i + '" aria-label="Tirar este responsável" title="Tirar">' +
          '<i class="ti ti-x" aria-hidden="true"></i></button>' +
      "</div>"
    );
  }

  function renderResps(lista) {
    var box = $("f-resps");
    if (!box) return;
    var l = (lista && lista.length) ? lista : [{ nome: "", email: "" }];
    box.innerHTML = l.map(function (r, i) {
      return htmlLinhaResp(i, r.nome, r.email);
    }).join("");
  }

  // Duas leituras, de proposito:
  //   lerLinhas() devolve TODAS as linhas, inclusive as vazias - e o que serve
  //   para repintar sem perder a linha que a pessoa acabou de abrir;
  //   lerResps() descarta as vazias - e o que serve para gravar.
  // Com uma leitura so (filtrando), clicar em "Adicionar" apagava a linha vazia
  // anterior no mesmo instante.
  function lerLinhas() {
    var box = $("f-resps");
    if (!box) return [];
    var out = [];
    box.querySelectorAll(".resp-linha").forEach(function (linha) {
      out.push({
        nome: (linha.querySelector(".resp-nome").value || "").trim(),
        email: (linha.querySelector(".resp-email").value || "").trim().toLowerCase()
      });
    });
    return out;
  }

  function lerResps() {
    return lerLinhas().filter(function (r) { return r.nome || r.email; });
  }

  function ligarResps() {
    var box = $("f-resps");
    var add = $("f-resp-add");
    if (!box || !add || box.dataset.ligado) return;
    box.dataset.ligado = "1";

    add.addEventListener("click", function () {
      var atuais = lerLinhas();
      atuais.push({ nome: "", email: "" });
      renderResps(atuais);
      var linhas = box.querySelectorAll(".resp-linha");
      var ultima = linhas[linhas.length - 1];
      if (ultima) ultima.querySelector(".resp-nome").focus();
    });

    box.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-resp-tirar]");
      if (!btn) return;
      var i = Number(btn.getAttribute("data-resp-tirar"));
      var atuais = lerLinhas();
      // Com uma linha so, tirar apenas limpa: a lista nunca fica sem lugar para
      // digitar.
      if (atuais.length <= 1) { renderResps([{ nome: "", email: "" }]); return; }
      atuais.splice(i, 1);
      renderResps(atuais);
    });
  }

  // ------------------------------------------------------------ preencher
  // extras.item = linha do cronograma daquela unidade, quando a tela tem.
  // Sem ela a data prevista vem do pedido de questionario, que e o que a tela
  // de EPOs sempre teve.
  function preencher(epo, extras) {
    var ex = extras || {};
    setVal("f-cod", epo && epo.cod);
    setVal("f-base", epo && epo.base);
    setVal("f-nome", epo && epo.nome);
    setVal("f-ativo", (epo && epo.ativo === false) ? "0" : "1");
    setVal("f-endereco", epo && epo.endereco);
    setVal("f-cidade", epo && epo.cidade);
    setVal("f-uf", (epo && epo.uf) || "SP");
    setVal("f-cep", epo && epo.cep);

    // Os responsaveis sao dado da UNIDADE. Antes o e-mail era reconstruido a
    // partir dos pedidos de questionario, e voltava vazio quando ainda nao
    // havia pedido: parecia que o dado tinha sido apagado.

    // Do pedido ainda vem a visita e a observacao. O pedido mais recente
    // manda, e os anteriores so preenchem o que ele deixou vazio: campo a
    // campo, dava para ver o e-mail de um pedido com a visita de outro.
    var email = (epo && epo.responsavel_email) || "", visita = "", obs = "";
    if (epo) {
      var meus = pedidos.filter(function (a) {
        return String(a.epoId) === String(epo.id);
      }).sort(function (x, y) {
        return String(y.criadoEm || "").localeCompare(String(x.criadoEm || ""));
      });
      if (meus.length) {
        if (!email) email = meus[0].email || "";
        visita = meus[0].visita ? String(meus[0].visita).slice(0, 10) : "";
        obs = meus[0].obs || "";
        meus.forEach(function (a) {
          if (!email && a.email) email = a.email;
          if (!visita && a.visita) visita = String(a.visita).slice(0, 10);
          if (!obs && a.obs) obs = a.obs;
        });
      }
    }

    // A lista vem pronta de quem abriu a tela (ex.responsaveis). Sem ela, cai
    // no par de campos que a unidade ja guardava, para a tela nao abrir vazia.
    var lista = (ex.responsaveis && ex.responsaveis.length)
      ? ex.responsaveis.map(function (r) {
          return { nome: r.nome || "", email: r.email || "" };
        })
      : [];
    if (!lista.length && epo && (epo.responsavel_nome || epo.responsavel_email || email)) {
      lista.push({ nome: epo.responsavel_nome || "", email: epo.responsavel_email || email || "" });
    }
    renderResps(lista);

    var it = ex.item || null;
    setVal("f-visita", (it && it.prevIniIso) || visita);
    setVal("f-ate", it && it.prevFimIso && it.prevFimIso !== it.prevIniIso ? it.prevFimIso : "");
    setVal("f-semana", (it && it.semana) || "");
    setVal("f-obs", (it && it.observacao) || obs);

    renderProcs(epo ? epo.id : null);
  }

  function limpar() {
    ["f-cod","f-base","f-nome","f-endereco","f-cidade","f-cep",
     "f-visita","f-ate","f-semana",
     "f-obs"].forEach(function (id) { setVal(id, ""); });
    renderResps([]);
    cepBuscado = "";
    var aviso = $("f-cep-aviso");
    if (aviso) aviso.textContent = "Preenche endereço, cidade e UF.";
    setVal("f-uf", "SP");
    setVal("f-ativo", "1");
    renderProcs(null);
  }

  // ------------------------------------------------------------------ ler
  function ler() {
    return {
      // Mesma limpeza da planilha (codigoLimpo, em cronograma-planilha.js).
      // Aceitar ponto e hifen aqui faria "143-620" digitado a mao e "143620"
      // vindo da planilha virarem duas unidades com o mesmo codigo.
      cod: txt("f-cod").toUpperCase().replace(/[^A-Z0-9]/g, ""),
      base: txt("f-base").toUpperCase(),
      nome: txt("f-nome"),
      ativo: val("f-ativo") !== "0",
      endereco: txt("f-endereco"),
      cidade: txt("f-cidade"),
      uf: val("f-uf") || "SP",
      cep: txt("f-cep"),
      // resps = a lista inteira. respNome/email seguem existindo como o
      // responsavel PRINCIPAL: e o e-mail que assina o pedido de questionario e
      // o que a unidade guarda no proprio cadastro.
      resps: lerResps(),
      respNome: (lerResps()[0] || {}).nome || "",
      email: ((lerResps()[0] || {}).email || "").toLowerCase(),
      visita: val("f-visita") || "",
      ate: val("f-ate") || "",
      semana: txt("f-semana"),
      obs: txt("f-obs"),
      procIds: marcados()
    };
  }

  // exigeCod: a tela de Cronograma sempre exige, porque o codigo e a chave da
  // planilha. Na tela de EPOs, unidade antiga pode nao ter: exigir travaria a
  // edicao de quem ja esta cadastrado sem codigo.
  function validar(d, editandoId, exigeCod) {
    if (!d.nome) return "Informe o nome da EPO.";
    if (!d.cidade) return "Informe a cidade da EPO.";
    if (exigeCod && !d.cod) return "Informe o código do fornecedor.";
    var ruim = null;
    (d.resps || []).forEach(function (r) {
      if (ruim) return;
      if (!r.email) { ruim = "Informe o e-mail de " + (r.nome || "cada responsável") + "."; return; }
      if (!/^\S+@\S+\.\S+$/.test(r.email)) ruim = "O e-mail " + r.email + " não parece válido.";
    });
    if (ruim) return ruim;

    // Dois responsaveis com o mesmo e-mail: um deles seria descartado sem
    // ninguem ver.
    var vistos = {};
    var repetido = null;
    (d.resps || []).forEach(function (r) {
      var k = r.email;
      if (vistos[k]) repetido = k;
      vistos[k] = true;
    });
    if (repetido) return "O e-mail " + repetido + " está repetido na lista de responsáveis.";

    if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) {
      return "Informe um e-mail válido para o responsável.";
    }
    if (d.procIds.length && !d.email) {
      return "Informe o e-mail de quem vai enviar os documentos desses questionários.";
    }
    // Antes, unidade nova com responsavel exigia marcar questionario: o acesso
    // do responsavel vinha do pedido, e sem pedido ele nao entrava. Agora a
    // lista de responsaveis e da unidade e o acesso vem dela, entao cadastrar a
    // unidade e pedir os questionarios sao dois passos, cada um no seu tempo.
    if (d.ate && !d.visita) return 'Preencheu "Até" sem a data da visita.';
    if (d.visita && d.ate && d.ate < d.visita) {
      return "A data final não pode ser anterior à inicial.";
    }
    return null;
  }

  // --------------------------------------------------------------- gravar
  // Endereco novo pede coordenada nova. Se o servico nao responder, grava sem
  // ela: o mapa aproxima pela cidade e a tela mostra que esta aproximado.
  function coordenadaPara(d, anterior) {
    if (!d.endereco || !window.GeoBR) return Promise.resolve({ lat: null, lng: null });
    var mudou = !anterior ||
      (anterior.endereco || "") !== d.endereco ||
      (anterior.cidade || "") !== d.cidade ||
      (anterior.uf || "") !== d.uf;
    if (!mudou && anterior && anterior.lat != null) {
      return Promise.resolve({ lat: anterior.lat, lng: anterior.lng });
    }
    return GeoBR.geocodificar(d.endereco, d.cidade, d.uf).then(function (p) {
      return p || { lat: null, lng: null };
    }, function () { return { lat: null, lng: null }; });
  }

  function erroDeCodigo(e) {
    var msg = (e && e.message) || "";
    if (String(e && e.code) === "23505" || /unique|duplicad/i.test(msg)) {
      return "Já existe unidade com este código e base. Procure por ela na tabela.";
    }
    // A recusa de alcance vinha crua, em inglês: "new row violates
    // row-level security policy". Quem leu isso foi a equipe de campo.
    if (String(e && e.code) === "42501" || /row-level security|policy/i.test(msg)) {
      return "Seu acesso não permite cadastrar ou alterar unidades. " +
             "Fale com a coordenação da APSIS.";
    }
    return null;
  }

  function gravarUnidade(db, d, epoId, anterior) {
    return coordenadaPara(d, anterior).then(function (coord) {
      var linha = {
        nome: d.nome,
        cidade: d.cidade,
        uf: d.uf,
        // A regional acompanha o UF: e o mesmo estado, gravado uma vez.
        regional: d.uf || null,
        endereco: d.endereco || null,
        cep: d.cep || null,
        cod_fornecedor: d.cod || null,
        base: d.base || "",
        responsavel_nome: d.respNome || null,
        responsavel_email: d.email || null,
        ativo: d.ativo,
        lat: coord.lat,
        lng: coord.lng
      };

      if (epoId) {
        return db.from("epos").update(linha).eq("id", epoId).select("id").then(function (r) {
          if (r.error) {
            var amigavel = erroDeCodigo(r.error);
            throw new Error(amigavel || r.error.message || "não foi possível salvar a unidade");
          }
          // Sem linha devolvida a unidade continua como estava: o acesso de
          // quem clicou nao alcanca a escrita. Dizer "salva" aqui seria mentira.
          if (!r.data || !r.data.length) {
            throw new Error("Seu acesso não permite alterar esta unidade.");
          }
          return epoId;
        });
      }

      linha.origem = "manual";
      // Sem ordem, o "primeiro cliente" e o que o banco devolver: no dia em
      // que existir um segundo, a unidade nasce sob o cliente errado.
      return db.from("clientes").select("id").order("id").limit(1).then(function (r) {
        if (r.error || !r.data || !r.data.length) {
          throw new Error((r.error && r.error.message) || "cliente não encontrado");
        }
        linha.cliente_id = r.data[0].id;
        return db.from("epos").insert(linha).select("id");
      }).then(function (r) {
        if (r.error) {
          var amigavel = erroDeCodigo(r.error);
          throw new Error(amigavel || r.error.message || "não foi possível cadastrar");
        }
        if (!r.data || !r.data.length) {
          throw new Error("Seu acesso não permite cadastrar unidade.");
        }
        return r.data[0].id;
      });
    });
  }

  // Cronograma. Este passo nunca derruba o cadastro: a unidade existe mesmo
  // que o ciclo deste ano ainda nao a inclua, e quem nao monta cronograma
  // (gerente da Claro) recebe o aviso em vez do erro.
  function sincronizarCronograma(db, d, epoId, ciclo, avisos, sempre) {
    // Sem data, a unidade NAO entra no cronograma. Antes entrava sempre: bastava
    // cadastrar a unidade para ela aparecer no cronograma sem data nenhuma, e a
    // tela do cronograma enchia de linhas que ninguem tinha agendado. Quem salva
    // de dentro do proprio cronograma continua entrando na lista (sempre=true):
    // ali a unidade sem data e justamente o que se quer ver.
    if (!d.visita && !sempre) return Promise.resolve(null);
    return db.rpc("cronograma_incluir", { p_epo: epoId, p_ciclo: ciclo || null })
      .then(function (r) {
        if (r.error) throw r.error;
        return r.data || null;
      })
      .then(function (item) {
        if (!item || !item.id || !d.visita) return null;

        var fim = d.ate || d.visita;
        var mudouData = item.data_prevista_inicio !== d.visita ||
                        (item.data_prevista_fim || "") !== fim;
        var mudouTexto =
          (d.semana && d.semana !== (item.semana_referencia || "")) ||
          (d.obs && d.obs !== (item.observacao || ""));

        if (!mudouData && !mudouTexto) return null;

        if (item.situacao === "realizada" || item.situacao === "nao_realizada") {
          avisos.push("A unidade já tem registro do que aconteceu, então a data do cronograma não mudou.");
          return null;
        }
        // Definir data limpa a confirmacao da Claro. Remarcar visita aprovada
        // e decisao do Cronograma, com o aviso de que desfaz a aprovacao:
        // nao pode acontecer de lado, ao editar o cadastro.
        if (item.confirmada_em) {
          avisos.push("A data desta unidade já foi aprovada pela Claro. Para remarcar, use a tela de Cronograma.");
          return null;
        }
        if (item.situacao === "aguardando_claro" && !mudouData) return null;
        if (item.situacao === "aguardando_claro") {
          avisos.push("A data mudou, então o pedido de aprovação voltou para conferência.");
        }

        return db.rpc("cronograma_definir_data", {
          p_item: item.id,
          p_inicio: d.visita,
          p_fim: d.ate || null,
          p_semana: d.semana || null,
          p_observacao: d.obs || null,
          p_enviar: false
        }).then(function (r) {
          if (r.error) throw r.error;
          return r.data || null;
        });
      })
      .catch(function (e) {
        var msg = (e && e.message) || "";
        if (/42501/.test(String(e && e.code)) || /nao permite|não permite/i.test(msg)) {
          avisos.push("A unidade foi salva. Quem monta o cronograma é a coordenação da APSIS.");
        } else {
          avisos.push("A unidade foi salva, mas não entrou no cronograma agora: " + (msg || "erro inesperado") + ".");
        }
        if (window.console && console.warn) console.warn("cronograma", e);
        return null;
      });
  }

  // A lista de responsaveis da unidade. Grava o que esta na tela e tira quem
  // saiu: a lista da tela E a lista da unidade.
  //
  // Nunca derruba o cadastro. Se este passo falhar, a unidade continua salva e o
  // aviso aparece - o contrario seria perder o cadastro por causa de um contato.
  function gravarResponsaveis(db, epoId, d, avisos) {
    var lista = (d.resps || []).filter(function (r) { return r.email; });
    return db.from("epo_responsaveis").select("id, email").eq("epo_id", epoId)
      .then(function (r) {
        if (r.error) throw r.error;
        var atuais = r.data || [];
        var querem = {};
        lista.forEach(function (x) { querem[x.email] = x; });

        var sobrando = atuais.filter(function (x) {
          return !querem[String(x.email || "").toLowerCase()];
        });
        var passo = Promise.resolve();
        if (sobrando.length) {
          passo = db.from("epo_responsaveis").delete()
            .in("id", sobrando.map(function (x) { return x.id; }))
            .then(function (rr) { if (rr.error) throw rr.error; });
        }
        return passo.then(function () {
          if (!lista.length) return [];
          // upsert pela chave (unidade, e-mail): editar o nome de quem ja esta
          // na lista nao pode criar linha nova.
          return db.from("epo_responsaveis")
            .upsert(lista.map(function (x) {
              return { epo_id: epoId, nome: x.nome || null, email: x.email };
            }), { onConflict: "epo_id,email" })
            .select("email")
            .then(function (rr) {
              if (rr.error) throw rr.error;
              return rr.data || [];
            });
        });
      })
      .catch(function (e) {
        var msg = (e && e.message) || "";
        avisos.push("A unidade foi salva, mas a lista de responsáveis não foi gravada agora" +
                    (msg ? ": " + msg : "") + ".");
        if (window.console && console.warn) console.warn("responsaveis", e);
        return [];
      });
  }

  // Uma linha por questionario, para tratar duplicidade isolada.
  function criarPedidos(db, epoId, d) {
    var res = { criados: 0, dups: [], erros: [], ids: [] };
    if (!d.procIds.length) return Promise.resolve(res);

    return window.Auth.sessao().then(function (s) {
      var criadoPor = s ? s.user.id : null;
      var cadeia = Promise.resolve();
      d.procIds.forEach(function (pid) {
        cadeia = cadeia.then(function () {
          return db.from("alocacoes").insert({
            epo_id: epoId,
            processo_id: pid,
            responsavel_email: d.email,
            status: "pendente",
            criado_por: criadoPor,
            visita_prevista: d.visita || null,
            observacao: d.obs || null
          }).select("id").then(function (r) {
            if (r.error) {
              var msg = r.error.message || "";
              if (r.error.code === "23505" || /duplicate|unique/i.test(msg)) res.dups.push(nomeProc(pid));
              else res.erros.push(nomeProc(pid) + " (" + msg + ")");
              return;
            }
            res.criados += 1;
            if (r.data && r.data[0]) res.ids.push(r.data[0].id);
          }, function (err) {
            res.erros.push(nomeProc(pid) + " (" + ((err && err.message) || "erro inesperado") + ")");
          });
        });
      });
      return cadeia.then(function () { return res; });
    });
  }

  // Os campos voltam preenchidos e sao editaveis, mas nada os gravava:
  // corrigir o e-mail do responsavel ou remarcar a visita de um pedido que ja
  // existe nao tinha efeito nenhum.
  function atualizarPedidos(db, epoId, d, editando) {
    if (!editando) return Promise.resolve([]);
    var mudanca = {};
    if (d.email) mudanca.responsavel_email = d.email;
    if (d.visita) mudanca.visita_prevista = d.visita;
    if (d.obs) mudanca.observacao = d.obs;
    if (!Object.keys(mudanca).length) return Promise.resolve([]);
    var jaTem = pedidos.some(function (a) { return String(a.epoId) === String(epoId); });
    if (!jaTem) return Promise.resolve([]);
    return db.from("alocacoes").update(mudanca).eq("epo_id", epoId).select("id").then(function (r) {
      if (r.error) throw r.error;
      return r.data || [];
    }, function (e) {
      if (window.console && console.warn) console.warn("atualizarPedidos", e);
      return [];
    });
  }

  // Convite: uma chamada por pessoa, nunca por questionario. Sem e-mail
  // entregue nao existe atalho: o link de definir senha e uma credencial e
  // nao pode aparecer na tela de quem cadastrou.
  //
  // Todos os responsaveis da unidade recebem, e nao so o primeiro: quem entra na
  // lista entra para trabalhar, e sem o e-mail nao tem como definir a senha.
  // Quem ja tinha acesso recebe um link para redefinir - a funcao trata os dois
  // casos e nao rebaixa quem ja tem senha.
  function convidar(db, res, d, epoId, novosEmails) {
    if (!db || !db.functions || !db.functions.invoke) return Promise.resolve({ ok: 0, falhas: 0 });

    var alvos = [];
    // O primeiro convite sai pelo pedido de questionario quando ha pedido novo:
    // assim o e-mail diz de qual unidade e de qual questionario se trata.
    if (res.criados && res.ids.length && d.email) {
      alvos.push({ corpo: { alocacao_id: res.ids[0] }, email: d.email });
    }
    (novosEmails || []).forEach(function (email) {
      if (!email) return;
      if (alvos.length && alvos[0].email === email) return;   // ja convidado acima
      alvos.push({ corpo: { email: email, epo_id: epoId }, email: email });
    });
    if (!alvos.length) return Promise.resolve({ ok: 0, falhas: 0 });

    var conta = { ok: 0, falhas: 0 };
    var cadeia = Promise.resolve();
    alvos.forEach(function (alvo) {
      cadeia = cadeia.then(function () {
        try {
          return db.functions.invoke("convidar-responsavel", { body: alvo.corpo })
            .then(function (r) {
              if (r && r.error) { conta.falhas += 1; return; }
              if (r && r.data && r.data.ok === false) { conta.falhas += 1; return; }
              conta.ok += 1;
            }, function () { conta.falhas += 1; });
        } catch (e) {
          conta.falhas += 1;
          return null;
        }
      });
    });
    return cadeia.then(function () { return conta; });
  }

  /* salvarTudo({ db, dados, epoId, anterior, ciclo, incluirNoCronograma })
     Resolve com { epoId, criados, dups, erros, convidado, avisos }.
     Recusa somente quando o cadastro em si nao foi gravado: o resto vira aviso,
     porque unidade gravada e passo seguinte falho nao pode virar "nao salvou". */
  function salvarTudo(o) {
    var db = o.db;
    var d = o.dados;
    var avisos = [];
    var criado = !o.epoId;
    var idFinal = null;
    var resultado = { criados: 0, dups: [], erros: [], ids: [] };

    var respsGravados = [];

    return gravarUnidade(db, d, o.epoId || null, o.anterior || null)
      .then(function (epoId) {
        idFinal = epoId;
        return gravarResponsaveis(db, epoId, d, avisos);
      })
      .then(function (gravados) {
        respsGravados = gravados || [];
        return sincronizarCronograma(db, d, idFinal, o.ciclo, avisos,
                                     !!o.incluirNoCronograma);
      })
      .then(function () {
        return atualizarPedidos(db, idFinal, d, !criado);
      })
      .then(function (mudados) {
        if (mudados && mudados.length && !d.procIds.length) {
          avisos.push(mudados.length +
            (mudados.length === 1 ? " questionário atualizado." : " questionários atualizados."));
        }
        return criarPedidos(db, idFinal, d);
      })
      .then(function (res) {
        resultado = res;
        var emails = respsGravados.map(function (x) { return String(x.email || "").toLowerCase(); });
        return convidar(db, res, d, idFinal, emails);
      })
      .then(function (conta) {
        if (conta.falhas) {
          avisos.push(conta.falhas === 1
            ? "Não foi possível enviar um dos e-mails de acesso agora. Reenvie pela tabela em alguns instantes."
            : "Não foi possível enviar " + conta.falhas + " e-mails de acesso agora. Reenvie pela tabela em alguns instantes.");
        }
        return {
          epoId: idFinal,
          criado: criado,
          criados: resultado.criados,
          dups: resultado.dups,
          erros: resultado.erros,
          convidado: conta.ok > 0,
          convidados: conta.ok,
          responsaveis: respsGravados.length,
          avisos: avisos
        };
      });
  }

  // Uma frase para o toast, igual nas duas telas.
  function resumo(r, d) {
    var partes = [];
    if (r.criados) {
      partes.push(r.criados + (r.criados === 1 ? " questionário pedido" : " questionários pedidos") +
        (d.email ? " para " + d.email : ""));
    }
    if (r.dups.length) partes.push("já existiam: " + r.dups.join(", "));
    if (r.erros.length) partes.push("falharam: " + r.erros.join("; "));
    if (r.convidados === 1) partes.push("link de acesso enviado");
    else if (r.convidados > 1) partes.push(r.convidados + " links de acesso enviados");
    if (d.visita) partes.push("data guardada, ainda não enviada para a Claro");
    r.avisos.forEach(function (a) { partes.push(a); });
    return partes.join(". ");
  }

  window.FormEpo = {
    UFS: UFS,
    colunas: colunas,
    preparar: preparar,
    atualizarListas: atualizarListas,
    preencher: preencher,
    limpar: limpar,
    renderProcs: renderProcs,
    ler: ler,
    validar: validar,
    salvarTudo: salvarTudo,
    resumo: resumo,
    marcados: marcados
  };
})();
