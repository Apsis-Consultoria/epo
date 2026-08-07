/* =========================================================================
   Auditoria de EPOs - camada de autenticação (Supabase Auth).
   - APSIS: SSO Microsoft (Entra ID) via provider "azure".
   - Cliente Claro: e-mail + código de 6 dígitos (OTP). Canal SMS plugável
     depois (Twilio) mantendo o mesmo fluxo.
   - Guard automático por página conforme papel (APP.papeisPreset).
   - Modo demonstração (sessionStorage.epoDemo) mantém o protótipo navegável
     sem conta - útil para demo com a Claro.
   Depende de: supabase-config.js + @supabase/supabase-js@2 (UMD) carregados antes.
   ========================================================================= */
(function () {
  "use strict";

  var PRONTO = window.supabase && window.SUPABASE_URL && window.SUPABASE_KEY;
  var client = PRONTO ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY) : null;

  // A biblioteca externa pode nao carregar (rede da EPO bloqueando o CDN, por
  // exemplo). Sem ela, toda tela cai no catalogo local, cujos nomes de EPO sao
  // quase iguais aos reais: alguem poderia trabalhar horas achando que esta
  // vendo o cadastro. O aviso aparece uma vez, e so quando nao foi o usuario
  // que escolheu a demonstracao.
  function avisarSemConexao() {
    if (document.getElementById("aviso-sem-conexao")) return;
    var barra = document.createElement("div");
    barra.id = "aviso-sem-conexao";
    barra.setAttribute("role", "status");
    barra.style.cssText =
      "position:fixed;left:0;right:0;top:0;z-index:200;padding:9px 16px;" +
      "background:#B84D01;color:#fff;font:500 13px Roboto,system-ui,Arial,sans-serif;text-align:center;";
    barra.textContent =
      "Sem conexão com os dados agora. Os números desta tela são de demonstração; " +
      "atualize a página quando a conexão voltar.";
    if (document.body) document.body.appendChild(barra);
    else document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(barra); });
  }

  // Endereco -> chave de permissao (mesmas chaves de APP.papeisPreset).
  //
  // Sem ".html": o endereco publicado e /epos, e nao /epos. Quem hospeda
  // resolve os dois para o mesmo arquivo, entao tudo que compara endereco tem de
  // comparar a forma limpa - senao um /epos digitado a mao (ou vindo de um
  // favorito antigo) passaria sem guard nenhum.
  var MAPA_PAGINAS = {
    "epos": "epos",
    "cronograma": "cronograma",
    "index": "geral",
    "ranking": "ranking",
    "comparar": "comparativo",
    "gerencial": "gerencial",
    "pendentes": "pendentes",
    "realizadas": "realizadas",
    "auditoria": "auditoria",
    "checagem": "checagem",
    "questionarios": "questionarios",
    // O detalhe da EPO andava pendurado na permissao do ranking. Tem chave
    // propria: e uma tela, aparece na matriz como as outras.
    "epo-detalhe": "detalhe",
    "alocacoes": "alocacoes",
    "contagem-giro": "giro",
    "evidencias": "evidencias",
    "acessos": "acessos"
  };

  // "epos", "epos", "/epo/epos?x=1", "" (a raiz) -> "epos" / "index".
  // Uma funcao so, usada por todo lugar que compara endereco: guard, filtro do
  // menu e os atalhos.
  function nomeDaPagina(endereco) {
    var t = String(endereco == null ? "" : endereco);
    t = t.split("#")[0].split("?")[0];
    t = t.split("/").pop();
    t = t.replace(/\.html$/i, "");
    return t === "" ? "index" : t;
  }

  // Primeira página permitida do papel (destino padrão pós-login/negado)
  function primeiraPermitida(perms) {
    // "realizadas" faltava nesta lista: um cargo que alcancasse SO essa tela
    // caia no fim do laco e era mandado para a tela de sem acesso.
    // Todas as 16 telas guardadas entram aqui. Chave que ficasse fora fazia um
    // cargo que alcanca SO aquela tela cair no fim do laco e ser mandado para a
    // pagina de sem acesso. O detalhe da EPO fica no fim de proposito: ele
    // sempre depende de escolher uma unidade antes, nao serve de porta de entrada.
    var ordem = ["geral", "epos", "cronograma", "pendentes", "realizadas", "auditoria", "checagem", "giro", "ranking", "comparativo", "gerencial", "alocacoes", "evidencias", "questionarios", "acessos", "detalhe"];
    var mapaInverso = {};
    Object.keys(MAPA_PAGINAS).forEach(function (arq) { mapaInverso[MAPA_PAGINAS[arq]] = arq; });
    for (var i = 0; i < ordem.length; i++) {
      if (!perms || perms[ordem[i]] !== false) return mapaInverso[ordem[i]] || "index";
    }
    // Nenhuma tela alcancada. Antes isto devolvia a tela de entrada, e com
    // sessao valida a entrada devolve para dentro: ida e volta sem fim. Quem nao
    // alcanca nada tem uma tela propria, que explica o que fazer.
    return "sem-acesso";
  }

  // Esconde do menu apenas o que o papel nao alcança. Fora disso o menu
  // mostra o sistema inteiro: tela que desaparece sem motivo passa a
  // impressao de que o sistema perdeu funcao.
  function filtrarNav(perms, papel) {
    // Secao marcada como somenteAdmin sai do menu de quem nao e administracao.
    // Isto e o que se MOSTRA, e nao o alcance: quem guarda o alcance continua
    // sendo a matriz, do lado do servidor. Serve para a demonstracao ao cliente
    // nao passar por tela que ainda nao esta em uso.
    var nav = (window.App && App.NAV) || [];
    nav.forEach(function (n) {
      if (!n.somenteAdmin || papel === "admin") return;
      document.querySelectorAll(
        '.nav-parent[data-subnav="' + n.key + '"], .nav-sub[data-subnav-panel="' + n.key + '"]'
      ).forEach(function (el) { el.style.display = "none"; });
      (n.children || []).forEach(function (c) {
        document.querySelectorAll('.nav a[href]').forEach(function (a) {
          if (nomeDaPagina(a.getAttribute("href")) === nomeDaPagina(c.href)) a.style.display = "none";
        });
      });
    });

    if (!perms) return;
    // Compara pelo NOME da pagina, e nao pelo texto do href: o menu pode ter
    // "epos", "epos" ou "epos?filtro=x" e as tres sao a mesma tela.
    var itens = document.querySelectorAll(".nav a[href]");
    Object.keys(MAPA_PAGINAS).forEach(function (arq) {
      var key = MAPA_PAGINAS[arq];
      if (perms[key] === false) {
        Array.prototype.forEach.call(itens, function (el) {
          if (nomeDaPagina(el.getAttribute("href")) === arq) el.style.display = "none";
        });
        // Seção com subtópicos (ex.: Configurações): o pai e o painel dos
        // filhos saem junto com o item.
        document.querySelectorAll(
          '.nav-parent[data-subnav="' + key + '"], .nav-sub[data-subnav-panel="' + key + '"]'
        ).forEach(function (el) { el.style.display = "none"; });
      }
    });
    // Secao sem nenhum filho visivel sai inteira. O cabecalho "Configuracoes"
    // tem chave propria, que nao e tela nenhuma: o laco acima escondia os
    // filhos um a um e o cabecalho ficava, abrindo um painel vazio - era o
    // que o responsavel da EPO e a equipe de campo viam.
    document.querySelectorAll(".nav-sub").forEach(function (painel) {
      var vivo = false;
      painel.querySelectorAll("a").forEach(function (a) {
        if (a.style.display !== "none") vivo = true;
      });
      if (vivo) return;
      painel.style.display = "none";
      var chave = painel.getAttribute("data-subnav-panel");
      var cab = document.querySelector('.nav-parent[data-subnav="' + chave + '"]');
      if (cab) cab.style.display = "none";
    });
    filtrarBarraInferior(perms);
  }

  // Barra inferior do mobile: sempre dois botões. O primeiro é "Relatórios"
  // (equipe APSIS preenche) ou "Enviar" (responsável da EPO anexa); o segundo
  // é a montagem de estoque.
  function filtrarBarraInferior(perms) {
    var bb = document.querySelector(".bottombar");
    if (!bb) return;
    var mostra = function (chave, on) {
      var el = bb.querySelector('[data-bb="' + chave + '"]');
      if (el) el.style.display = on ? "" : "none";
    };
    var pendentes = perms.pendentes !== false;
    mostra("pendentes", pendentes);
    // Quem nao preenche auditoria anexa evidencia: e a mesma tela onde ele ve
    // o que os outros lados mandaram.
    mostra("checagem", !pendentes && perms.checagem !== false);
    mostra("giro", perms.giro !== false);
  }

  function arquivoAtual() {
    return nomeDaPagina(location.pathname);
  }

  // O modo demonstracao existe para mostrar o sistema sem conta, e por isso o
  // guard inteiro passa ao largo dele: sem sessao, sem segundo fator, sem papel.
  // Isso e aceitavel numa maquina de desenvolvimento e nao no ar: no site
  // publicado, uma linha no console do navegador dava a estrutura inteira do
  // sistema a quem nao entrou, e deixava uma sessao com segundo fator pendente
  // circular pela interface em vez de ficar presa na confirmacao.
  //
  // Nenhum botao do sistema liga essa chave, entao restringir a maquina local nao
  // tira funcao de ninguem.
  function ambienteLocal() {
    var h = location.hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "" || h === "[::1]";
  }

  function modoDemo() {
    if (!ambienteLocal()) return false;
    try { return sessionStorage.getItem("epoDemo") === "1"; } catch (e) { return false; }
  }

  // Papel escolhido na entrada de teste. Vazio = vê tudo, como sempre foi.
  // Serve para conferir a tela de um perfil antes de o acesso dele existir.
  function papelDemo() {
    try { return sessionStorage.getItem("epoDemoPapel") || ""; } catch (e) { return ""; }
  }

  var NOME_DEMO = {
    responsavel: "Responsável pela EPO (teste)",
    cliente: "Gerencia Claro (teste)",
    auditor: "Equipe de Campo Apsis (teste)"
  };

  // -------------------------------------------------------------- Ver como
  // Quem administra pode olhar o sistema pelo angulo de outro perfil SEM sair
  // da propria sessao: os dados continuam sendo os de verdade, so o menu e as
  // telas obedecem as permissoes do papel escolhido. E o que permite criar a
  // EPO com a conta Microsoft e conferir o resultado na tela do responsavel e
  // na do consultor, tudo no mesmo banco.
  var PAPEIS_QUE_SIMULAM = ["admin", "gestor"];
  // E o que se pode VESTIR ao simular. So os dois que o menu oferece.
  //
  // Antes a validacao aceitava qualquer chave existente em papeisPreset, e
  // 'admin' e uma delas: gravar epoVerComo igual a admin passava, e
  // permissoesDe('admin') devolve todas as telas em true ANTES de olhar a matriz
  // do servidor. Um gestor restringido na tela de Gerenciamento de acessos
  // desfazia a propria restricao com uma linha no console, sem rastro. Simular
  // serve para ver o sistema pelos olhos de quem tem MENOS acesso, nunca de quem
  // tem mais.
  var PERSPECTIVAS = ["auditor", "responsavel"];

  // Coordenacao (admin, gestor da APSIS e gerente da Claro) ve o sistema
  // inteiro: sao as MESMAS telas. As duas visoes diferentes de verdade sao a do
  // consultor em campo e a do responsavel da EPO, e sao essas que se simula.
  var ROTULO_PERSPECTIVA = {
    auditor: "consultor APSIS",
    responsavel: "responsável da EPO"
  };

  function verComo() {
    try { return sessionStorage.getItem("epoVerComo") || ""; } catch (e) { return ""; }
  }

  function definirVerComo(papel) {
    // Recusa na origem tambem, e nao so na conferencia: assim o valor invalido
    // nem chega a ser guardado.
    if (papel && PERSPECTIVAS.indexOf(papel) < 0) return;
    try {
      if (papel) sessionStorage.setItem("epoVerComo", papel);
      else sessionStorage.removeItem("epoVerComo");
    } catch (e) {}
    var presets = (window.APP && window.APP.papeisPreset) || {};
    location.href = papel ? primeiraPermitida(presets[papel]) : "index";
  }

  function iniciais(nome) {
    return String(nome || "?").trim().split(/\s+/).slice(0, 2)
      .map(function (n) { return n.charAt(0).toUpperCase(); }).join("");
  }

  // ----------------------------------------------------------------- Sessão
  function sessao() {
    if (!client) return Promise.resolve(null);
    return client.auth.getSession().then(function (r) {
      return (r.data && r.data.session) || null;
    });
  }

  function perfilDe(user) {
    return client.from("perfis").select("nome, papel, cliente_id")
      .eq("user_id", user.id).maybeSingle()
      .then(function (r) {
        // Sem linha de perfil, a conta NAO tem acesso. Antes esta linha
        // devolvia "auditor", entao quem entrasse sem liberacao era tratado
        // pela tela como consultor da APSIS: o menu abria e as telas apareciam
        // vazias, sem ninguem entender por que.
        return r.data || { nome: user.email, papel: "sem_acesso", cliente_id: null };
      });
  }

  // Perfil de quem está logado, para a tela decidir o que mostrar por papel.
  // Guardado em memória: o guard e a tela pedem a mesma coisa. Devolve null no
  // modo demonstração e quando não há sessão.
  var promessaPerfil = null;
  function perfil() {
    if (promessaPerfil) return promessaPerfil;
    if (modoDemo() || !client) return Promise.resolve(null);
    promessaPerfil = sessao().then(function (s) {
      if (!s) return null;
      return perfilDe(s.user);
    }).catch(function () { return null; });
    return promessaPerfil;
  }

  // Duas correcoes de papel, uma vez por carregamento:
  // - quem foi liberado na lista de acessos depois de a conta existir;
  // - quem ganhou relatorio pedido depois de ja ter conta.
  // As duas sao decisoes que a APSIS ja tomou; aqui elas so chegam ao perfil.
  var papelSincronizado = false;
  // As duas sincronizacoes saem juntas: uma acerta o papel pela lista de
  // e-mails autorizados, a outra pela lista de responsaveis de unidade, e
  // nenhuma le o resultado da outra. Em fila eram duas esperas de rede.
  function sincronizarPapel() {
    if (papelSincronizado || !client) return Promise.resolve();
    papelSincronizado = true;
    var quieto = function () {};
    return Promise.all([
      client.rpc("sincronizar_meu_acesso").then(quieto, quieto),
      client.rpc("sincronizar_papel_responsavel").then(quieto, quieto)
    ]);
  }

  // ---------------------------------------------- Telas por cargo
  // A decisao de quais telas cada cargo alcanca fica guardada no sistema e e
  // editada na tela de Gerenciamento de acessos. O padrao escrito no codigo
  // continua valendo como reserva: se a leitura falhar, o menu nao desaba.
  var promessaPermissoes = null;
  // Falso enquanto a matriz do servidor nao chegou nesta carga de tela.
  var matrizChegou = false;
  function permissoesGravadas() {
    if (promessaPermissoes) return promessaPermissoes;
    if (!client) return Promise.resolve(null);
    promessaPermissoes = client.from("permissoes_papel")
      .select("papel, tela, permitido")
      .then(function (r) {
        if (r.error || !r.data || !r.data.length) {
          // Leitura vazia NAO fica guardada. Na tela de entrada esta consulta
          // roda antes de haver sessao, e o servidor nao mostra a matriz a quem
          // nao entrou: guardar esse vazio fazia o destino pos-entrada ser
          // decidido pelo padrao escrito no codigo, e nao pela matriz.
          promessaPermissoes = null;
          // E marca que a matriz do servidor NAO chegou. Antes isso se confundia
          // com "matriz chegou vazia", e as duas caiam no padrao do codigo: quem
          // estava na tela bloqueava esta chamada no painel do navegador e
          // recuperava as telas que a matriz nega - inclusive a de Gerenciamento
          // de acessos, negada de proposito ao papel cliente. Agora quem le sabe
          // a diferenca e pode fechar em vez de abrir.
          matrizChegou = false;
          return null;
        }
        matrizChegou = true;
        var mapa = {};
        r.data.forEach(function (x) {
          if (!mapa[x.papel]) mapa[x.papel] = {};
          mapa[x.papel][x.tela] = !!x.permitido;
        });
        return mapa;
      })
      .catch(function () { promessaPermissoes = null; return null; });
    return promessaPermissoes;
  }

  // Administrador alcanca tudo, sempre, e nao entra na tabela: se um dia
  // alguem se trancasse fora por engano, e por ele que se conserta.
  function permissoesDe(papel, gravadas) {
    if (papel === "admin") {
      var tudo = {};
      Object.keys(MAPA_PAGINAS).forEach(function (arq) { tudo[MAPA_PAGINAS[arq]] = true; });
      return tudo;
    }
    var base = ((window.APP && window.APP.papeisPreset) || {})[papel];
    if (!base) return null;
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = !!base[k]; });
    if (gravadas && gravadas[papel]) {
      Object.keys(gravadas[papel]).forEach(function (k) { out[k] = gravadas[papel][k]; });
    }
    return out;
  }

  // Telas que quem entrou alcanca. A tela pergunta antes de oferecer um botao
  // que leva para outra: botao que abre e volta na hora, ou pior, que abre uma
  // tela que a pessoa nao pode usar, e pior do que botao que nao existe.
  //
  // Guardado depois do guard, que ja calculou isto. Se alguem perguntar antes,
  // calcula na hora.
  var permsAtuais = null;
  function telas() {
    if (permsAtuais) return Promise.resolve(permsAtuais);
    if (modoDemo()) {
      var presets = (window.APP && window.APP.papeisPreset) || {};
      permsAtuais = presets[papelDemo()] || null;
      return Promise.resolve(permsAtuais);
    }
    var gravadas = null;
    return permissoesGravadas()
      .then(function (g) { gravadas = g; return perfil(); })
      .then(function (p) {
        if (!p) return null;
        var simulado = verComo();
        if (simulado && (PAPEIS_QUE_SIMULAM.indexOf(p.papel) < 0
                         || PERSPECTIVAS.indexOf(simulado) < 0)) simulado = "";
        var perms = permissoesDe(simulado || p.papel, gravadas);
        // Sem a matriz, o que se tem e o padrao do codigo: serve para nao travar
        // a tela, mas nao vale guardar como se fosse a decisao gravada.
        if (gravadas) permsAtuais = perms;
        return perms;
      })
      .catch(function () { return null; });
  }

  // Telas que decidem quem alcanca o que. Sem a matriz do servidor em maos,
  // estas NAO sao liberadas: e melhor a pessoa certa clicar duas vezes do que a
  // errada abrir o editor de cargos.
  var TELAS_DE_ADMINISTRACAO = ["acessos", "questionarios"];

  // Sem resposta (leitura falhou, sem sessao) responde que alcanca: a tela segue
  // como sempre foi, e quem barra de verdade e o servidor. A excecao sao as telas
  // de administracao acima, que fecham quando a matriz nao chegou.
  function podeTela(chave) {
    return telas().then(function (p) {
      if (!p) return !(!matrizChegou && TELAS_DE_ADMINISTRACAO.indexOf(chave) >= 0);
      return p[chave] !== false;
    });
  }

  // Para onde levar quem entrou (ou quem clica em "voltar"): a primeira tela
  // dele, e nao a visao geral, que boa parte dos cargos nem alcanca. Sem isto,
  // toda entrada passava pela visao geral e era desviada de la, o que aparece
  // como um piscar de tela sem explicacao.
  function telaInicial() {
    return perfil().then(function (pf) {
      if (pf && pf.papel === "sem_acesso") return "sem-acesso";
      return telas().then(function (p) { return primeiraPermitida(p); });
    }, function () {
      return telas().then(function (p) { return primeiraPermitida(p); });
    });
  }

  // ------------------------------------------------------- Segundo fator
  // O codigo nunca e gerado nem conferido aqui: a tela so pergunta a situacao,
  // pede o envio e manda o que a pessoa digitou. Quem decide e o servidor.
  function mfaSituacao() {
    if (!client) return Promise.resolve({ ligada: false, precisa: false });
    return client.rpc("mfa_situacao").then(function (r) {
      if (r.error) throw r.error;
      return r.data || { ligada: false, precisa: false };
    });
  }

  function mfaEnviarCodigo() {
    if (!client) return Promise.reject(new Error("Envio indisponível no momento."));
    return client.functions.invoke("enviar-codigo-acesso", { body: {} })
      .then(function (r) {
        // A função responde 502 com motivo legível quando o e-mail não sai; o
        // corpo da resposta é mais útil que o erro de transporte.
        var d = r.data || {};
        if (d.ok) return d;
        throw new Error(d.motivo ||
          "Não foi possível enviar o código agora. Tente de novo em alguns instantes.");
      });
  }

  function mfaConfirmar(codigo) {
    if (!client) return Promise.reject(new Error("Confirmação indisponível no momento."));
    return client.rpc("mfa_confirmar", { p_codigo: String(codigo || "") })
      .then(function (r) {
        if (r.error) throw r.error;
        return r.data || { ok: false, motivo: "Não foi possível confirmar agora." };
      });
  }

  // ---------------------------------------------------------------- Login

  // Quais formas de entrar estão ligadas. Consulta leve, sem efeito nenhum, e
  // guardada em memória: uma vez por carregamento da página basta.
  var promessaFormas = null;
  function formasDeEntrar() {
    if (promessaFormas) return promessaFormas;
    if (!PRONTO) return Promise.resolve({});
    promessaFormas = fetch(window.SUPABASE_URL + "/auth/v1/settings", {
      headers: { apikey: window.SUPABASE_KEY }
    }).then(function (r) {
      return r.ok ? r.json() : {};
    }).then(function (j) {
      return (j && j.external) || {};
    }).catch(function () {
      return {};   // sem resposta: não bloqueia, deixa tentar
    });
    return promessaFormas;
  }

  function destinoPosLogin() {
    return location.origin + location.pathname.replace(/login(\.html)?.*$/, "") + "index";
  }

  // Antes de sair da página, confere se a conta Microsoft está ligada. Sem essa
  // conferência o navegador ia embora e parava numa página em branco com o erro
  // cru, sem volta e sem explicação para quem está tentando entrar.
  function entrarMicrosoft() {
    if (!client) return Promise.reject(new Error("Login indisponível no momento."));
    return formasDeEntrar().then(function (formas) {
      if (formas.azure === false) {
        console.warn("entrarMicrosoft: conta Microsoft ainda não liberada na configuração de acesso");
        return { data: null, error: { message: "Entrada pela conta Microsoft ainda não liberada." } };
      }
      return client.auth.signInWithOAuth({
        provider: "azure",
        options: {
          scopes: "email openid profile",
          // prompt=select_account faz a Microsoft SEMPRE perguntar de qual conta
          // se trata. Sem isso, quem tem sessao aberta no navegador entra
          // instantaneamente e sem interacao nenhuma - o que parece o sistema
          // logando por conta propria, e impede trocar de conta sem limpar o
          // navegador.
          queryParams: { prompt: "select_account" },
          redirectTo: destinoPosLogin()
        }
      });
    });
  }

  // Cliente Claro e responsável da EPO: e-mail e senha. A primeira senha é
  // definida pelo próprio dono do e-mail, pelo link que ele recebe.
  // captchaToken so vai quando a tela tiver um: com o captcha desligado ele e
  // ------------------------------------------------- Entrada por codigo
  // A Gerencia Claro e o responsavel da EPO nao tem senha neste sistema:
  // informam o e-mail, recebem um codigo de seis digitos e digitam. Nao ha senha
  // para criar, guardar, esquecer nem redefinir, e nenhum link fica valendo numa
  // caixa de e-mail.
  //
  // Em dois passos, cada um com a sua funcao de servidor:
  //   1) pedirCodigoDeEntrada - o servidor gera o codigo, guarda so o resumo
  //      criptografico e envia por e-mail. A tela nunca sabe o codigo;
  //   2) entrarComCodigo - o servidor confere o que a pessoa digitou e devolve
  //      uma credencial de uso unico, que ESTA tela troca por sessao. A sessao
  //      nasce no navegador de quem esta entrando, e nao no servidor.
  function pedirCodigoDeEntrada(email, captchaToken) {
    if (!client || !client.functions || !client.functions.invoke) {
      return Promise.reject(new Error("Entrada indisponível no momento."));
    }
    function daResposta(d) {
      d = d || {};
      return {
        enviado: !!d.enviado,
        espere: Number(d.espere || 0),
        para: d.para || "",
        minutos: Number(d.minutos || 0)
      };
    }
    // O captcha do servico de autenticacao nao alcanca este caminho: o pedido
    // passa pela nossa funcao. O token vai no corpo e e conferido la.
    var corpo = { email: email };
    if (captchaToken) corpo.captcha = captchaToken;
    return client.functions.invoke("enviar-codigo-entrada", { body: corpo })
      .then(function (r) {
        if (!r.error) return daResposta(r.data);
        // O corpo da recusa traz o que aconteceu; a mensagem do erro, nao.
        var ctx = r.error.context;
        if (ctx && typeof ctx.json === "function") {
          return ctx.json().then(daResposta, function () { return daResposta(null); });
        }
        return daResposta(null);
      });
  }

  function entrarComCodigo(email, codigo, captchaToken) {
    if (!client || !client.functions || !client.functions.invoke) {
      return Promise.reject(new Error("Entrada indisponível no momento."));
    }
    function daResposta(d) {
      d = d || {};
      return { ok: !!d.ok, motivo: d.motivo || "", credencial: d.credencial || "" };
    }
    // O token do captcha vai TAMBEM aqui, e nao so no pedido do codigo. Sem ele
    // neste passo, quem soubesse o e-mail de alguem gastava as cinco tentativas
    // com numeros errados no instante em que a pessoa pedisse o codigo: na quinta
    // o servidor apaga o codigo, e quem tinha o numero certo ouve que nao ha
    // codigo em aberto.
    var corpo = { email: email, codigo: codigo };
    if (captchaToken) corpo.captcha = captchaToken;
    return client.functions.invoke("confirmar-codigo-entrada", { body: corpo })
      .then(function (r) {
        if (!r.error) return daResposta(r.data);
        var ctx = r.error.context;
        if (ctx && typeof ctx.json === "function") {
          return ctx.json().then(daResposta, function () { return daResposta(null); });
        }
        return daResposta(null);
      })
      .then(function (d) {
        if (!d.ok || !d.credencial) {
          return { ok: false, motivo: d.motivo ||
            "Código incorreto ou expirado. Peça um código novo." };
        }
        // A credencial serve UMA vez e vale poucos minutos. Quem a troca por
        // sessao e este navegador, entao a sessao funciona mesmo que o codigo
        // tenha sido pedido em outro aparelho.
        return client.auth.verifyOtp({ token_hash: d.credencial, type: "magiclink" })
          .then(function (r2) {
            if (r2 && r2.error) {
              if (window.console && console.warn) console.warn("verifyOtp", r2.error);
              return { ok: false, motivo:
                "Não foi possível abrir a sessão agora. Peça um código novo." };
            }
            return { ok: true };
          });
      });
  }


  function sair() {
    try {
      sessionStorage.removeItem("epoDemo");
      sessionStorage.removeItem("epoDemoPapel");
      // A perspectiva escolhida em "Ver como" sobrevivia ao logout: quem
      // entrasse depois caia direto na visao de outro papel, com menos telas,
      // sem entender por que.
      sessionStorage.removeItem("epoVerComo");
    } catch (e) {}
    // A sessao sai do navegador AQUI, na mao, e nao so pelo signOut.
    //
    // O signOut limpa a chave que o cliente atual usa. Sobrando qualquer outra
    // (troca de formato de chave do projeto deixa mais de uma), a tela de entrada
    // encontra sessao valida e manda a pessoa de volta para dentro - e como a
    // conta Microsoft continua aberta do lado da Microsoft, a volta acontece sem
    // pedir nada. Quem clicou em Sair ve o sistema se reabrir sozinho.
    var limparTokens = function () {
      try {
        Object.keys(localStorage).forEach(function (k) {
          if (/^sb-.*-auth-token/.test(k)) localStorage.removeItem(k);
        });
      } catch (e) {}
    };

    // Vai para a entrada limpa, sem parametro e sem mensagem: quem clicou em Sair
    // sabe que saiu, e nao precisa que a tela conte isso de volta.
    //
    // NAO usa "login?sair=1": aquele caminho existe como socorro manual e corta a
    // execucao da tela antes de ligar os botoes - depois dele nada e clicavel.
    // Aqui a sessao ja foi apagada duas vezes (signOut e a varredura acima), entao
    // a entrada simples nao encontra nada e fica onde esta.
    var fim = function () { limparTokens(); location.replace("login"); };
    if (!client) { fim(); return; }
    client.auth.signOut()
      .then(function (r) {
        if (r && r.error) return client.auth.signOut({ scope: "local" });
        return null;
      }, function () { return client.auth.signOut({ scope: "local" }); })
      .then(fim, fim);
  }

  // papel vazio = visitante, com todas as telas. Com papel, entra já na
  // primeira tela permitida daquele perfil.
  function entrarDemo(papel) {
    try {
      sessionStorage.setItem("epoDemo", "1");
      if (papel) sessionStorage.setItem("epoDemoPapel", papel);
      else sessionStorage.removeItem("epoDemoPapel");
    } catch (e) {}
    var presets = (window.APP && window.APP.papeisPreset) || {};
    var perms = papel ? presets[papel] : null;
    location.href = perms ? primeiraPermitida(perms) : "index";
  }

  // ------------------------------------------------------------------- UI
  // Ligado assim que a tela existe, e nao depois de carregar o perfil. Estava
  // dentro de atualizarUi: quando a leitura do perfil falhava, o Sair continuava
  // sendo um link comum para login, ou seja, saia da tela SEM encerrar a
  // sessao - e o login, vendo sessao valida, devolvia a pessoa para dentro.
  // Sair e justamente o que tem de funcionar quando o resto falhou.
  function ligarSair() {
    var link = document.querySelector('.user-menu a[href="login"], .user-menu a[href="login"]');
    if (!link || link.dataset.authWired) return;
    link.dataset.authWired = "1";
    link.addEventListener("click", function (ev) {
      ev.preventDefault();
      sair();
    });
  }

  // "Voltar à página inicial" levava sempre para a visão geral, que a equipe de
  // campo e o responsável da EPO não alcançam: a tela abria e o guard desviava
  // no ato, então o botão prometia um lugar e entregava outro. Agora leva para
  // a primeira tela de quem clicou - para quem alcança a visão geral, é ela
  // mesma, e nada muda.
  function ligarVoltarInicio() {
    document.addEventListener("click", function (ev) {
      var alvo = ev.target;
      if (!alvo || !alvo.closest) return;
      // Qualquer link que aponte para a visao geral, escrito como "index",
      // "index" ou "./".
      var a = alvo.closest("a[href]");
      if (!a || nomeDaPagina(a.getAttribute("href")) !== "index") return;
      ev.preventDefault();
      telaInicial().then(function (destino) {
        location.href = destino || "index";
      }, function () { location.href = "index"; });
    });
  }

  function atualizarUi(info) {
    var nm = document.querySelector(".user-menu .nm");
    var em = document.querySelector(".user-menu .em");
    if (nm) nm.textContent = info.nome || "Usuário";
    if (em) em.textContent = info.email || "";
    var av = document.querySelector(".avatar-btn");
    if (av && info.nome) {
      av.innerHTML = "";
      av.textContent = iniciais(info.nome);
      av.style.fontSize = "12px";
      av.style.fontWeight = "600";
      av.title = info.nome + (info.papel ? " · " + info.papel : "");
    }
    ligarSair();

    if (info.podeSimular) montarVerComo(info.simulado);
    if (info.simulado) montarAvisoVerComo(info.simulado);
  }

  // Opções de perspectiva dentro do menu da conta
  function montarVerComo(simulado) {
    var menu = document.querySelector(".user-menu");
    if (!menu || menu.querySelector(".ver-como")) return;

    var opcoes = ["auditor", "responsavel"].map(function (papel) {
      var atual = papel === simulado;
      return '<button type="button" class="user-menu-item ver-como-item' +
        (atual ? " is-atual" : "") + '" data-ver-como="' + papel + '">' +
        '<i class="ti ' + (atual ? "ti-eye-check" : "ti-eye") + '" aria-hidden="true"></i>' +
        "Ver como " + ROTULO_PERSPECTIVA[papel] +
        "</button>";
    }).join("");

    var bloco = document.createElement("div");
    bloco.className = "ver-como";
    bloco.innerHTML =
      '<p class="ver-como-titulo">Perspectiva</p>' + opcoes +
      (simulado
        ? '<button type="button" class="user-menu-item" data-ver-como="">' +
            '<i class="ti ti-arrow-back-up" aria-hidden="true"></i>Voltar ao meu acesso</button>'
        : "");

    var sair = menu.querySelector('a[href="login"], a[href="login"]');
    if (sair) menu.insertBefore(bloco, sair);
    else menu.appendChild(bloco);

    bloco.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-ver-como]");
      if (!b) return;
      definirVerComo(b.getAttribute("data-ver-como"));
    });
  }

  // Faixa na topbar: sem isso, o menu encurtado parece defeito
  function montarAvisoVerComo(simulado) {
    var acoes = document.querySelector(".topbar-actions");
    if (!acoes || document.querySelector(".ver-como-chip")) return;
    var chip = document.createElement("button");
    chip.type = "button";
    chip.className = "ver-como-chip";
    chip.title = "Voltar ao meu acesso";
    chip.innerHTML = '<i class="ti ti-eye" aria-hidden="true"></i>' +
      "<span>Vendo como " + ROTULO_PERSPECTIVA[simulado] + "</span>" +
      '<i class="ti ti-x" aria-hidden="true"></i>';
    chip.addEventListener("click", function () { definirVerComo(""); });
    acoes.insertBefore(chip, acoes.firstChild);
  }

  // ------------------------------------------------------------------ Guard
  function guard(pageKey) {
    if (modoDemo()) {
      var papelT = papelDemo();
      var presets = (window.APP && window.APP.papeisPreset) || {};
      var permsT = papelT ? presets[papelT] : null;
      // Na entrada de teste por papel, a tela obedece às mesmas permissões do
      // papel de verdade: menu filtrado e página fora do alcance é redirecionada.
      if (permsT && pageKey && permsT[pageKey] === false) {
        location.replace(primeiraPermitida(permsT));
        return Promise.resolve("sem-permissao");
      }
      atualizarUi({
        nome: NOME_DEMO[papelT] || "Visitante",
        email: "",
        papel: papelT
      });
      filtrarNav(permsT, papelT);
      return Promise.resolve("demo");
    }
    if (!client) {
      // Sem a biblioteca de dados (ex.: offline): a tela continua navegavel com
      // o catalogo local, mas isso precisa ficar visivel.
      avisarSemConexao();
      return Promise.resolve("offline");
    }
    return sessao().then(function (s) {
      if (!s) { location.replace("login"); return "sem-sessao"; }

      // O segundo fator continua sendo a primeira coisa DECIDIDA, mas a busca do
      // papel e da matriz de telas sai junto com ele em vez de esperar na fila.
      // Quem entrou por codigo no e-mail ou pela conta Microsoft nunca precisa de
      // um segundo codigo, e nesse caminho - que e o de todo mundo - era uma ida
      // de rede inteira parada esperando uma resposta que sempre vem igual.
      //
      // Nada e APLICADO antes da resposta do segundo fator: se ele for
      // necessario, a tela e trocada e o que veio junto e descartado.
      var pSegundoFator = mfaSituacao().catch(function () { return { precisa: false }; });
      var pQuemE = buscarPerfil(s).then(
        function (d) { return d; },
        function (e) { return { erro: e }; });

      return pSegundoFator.then(function (m) {
        if (m && m.precisa) {
          location.replace("confirmar-acesso");
          return "precisa-codigo";
        }
        return pQuemE.then(function (d) {
          if (d && d.erro) throw d.erro;
          return aplicarPerfil(s, pageKey, d.perfil, d.gravadas);
        });
      });
    });
  }

  // Busca quem e a pessoa e o que o cargo dela alcanca. So busca: nao mexe na
  // tela, para poder sair junto com a resposta do segundo fator.
  //
  // A matriz de telas sai JUNTO com a sincronizacao do papel, porque nao depende
  // dela. O perfil, sim, tem de vir depois: e a sincronizacao que acerta o papel
  // a partir da lista de e-mails autorizados, e ler antes traria o papel velho.
  function buscarPerfil(s) {
    return Promise.all([sincronizarPapel(), permissoesGravadas()])
      .then(function (par) {
        return perfilDe(s.user).then(function (p) {
          return { gravadas: par[1], perfil: p };
        });
      });
  }

  // Aplica na tela: nome de quem entrou, desvio por permissao e filtro do menu.
  //
  // pageKey vem por parametro. Antes esta funcao usava a variavel sem receber, e
  // dava ReferenceError: a promessa quebrava no meio, o nome de quem entrou nao
  // aparecia, o menu nao era filtrado e quem nao tinha permissao para a tela
  // deixava de ser desviado. So acontecia em sessao de verdade, e foi por isso
  // que passou.
  function aplicarPerfil(s, pageKey, p, gravadas) {
    return Promise.resolve(p)
      .then(function (p) {
        if (p.papel === "sem_acesso") {
          location.replace("sem-acesso");
          return "sem-acesso";
        }
        // Nao existe mais tela de definir senha: quem nao entra pela conta
        // Microsoft entra por codigo no e-mail, e o codigo ja e a prova. A marca
        // de "senha ainda nao definida" deixou de mandar para lugar nenhum.
        var mapa = (window.APP && window.APP.papeisPreset) || {};
        var podeSimular = PAPEIS_QUE_SIMULAM.indexOf(p.papel) >= 0;
        var simulado = verComo();
        if (simulado && (!podeSimular || !mapa[simulado]
                         || PERSPECTIVAS.indexOf(simulado) < 0)) {
          // papel sem direito a simular, perspectiva desconhecida, ou tentativa
          // de vestir um papel de mais acesso do que o proprio
          try { sessionStorage.removeItem("epoVerComo"); } catch (e) {}
          simulado = "";
        }

        var perms = permissoesDe(simulado || p.papel, gravadas);
        permsAtuais = perms;
        if (perms && pageKey && perms[pageKey] === false) {
          location.replace(primeiraPermitida(perms));
          return "sem-permissao";
        }
        // Matriz do servidor nao chegou e a tela e das que decidem acesso: fecha.
        //
        // Sem a matriz, permissoesDe cai no padrao escrito no codigo, e o padrao
        // do papel cliente traz a tela de Gerenciamento de acessos como
        // permitida - o oposto do que o servidor guarda. Quem estava na tela
        // bloqueava a chamada da matriz no painel do navegador e recuperava o
        // editor de cargos. A lista de acessos em si continua vazia, porque o
        // servidor nao a entrega, mas decisao administrativa nao pode depender de
        // uma consulta ter chegado.
        if (!matrizChegou && p.papel !== "admin" && pageKey
            && TELAS_DE_ADMINISTRACAO.indexOf(pageKey) >= 0) {
          location.replace(primeiraPermitida(perms));
          return "sem-permissao";
        }
        atualizarUi({
          nome: p.nome,
          email: s.user.email,
          papel: p.papel,
          simulado: simulado,
          podeSimular: podeSimular
        });
        filtrarNav(perms, simulado || p.papel);
        return simulado ? "ver-como" : "ok";
      });
  }

  // Endereco antigo se limpa sozinho: /epos.html vira /epos na barra, e
  // /index.html vira a raiz. Sem recarregar nada - so troca o que esta escrito.
  //
  // Quem hospeda o site serve as duas formas, entao um favorito antigo continua
  // funcionando; o que ficava era o ".html" na barra, e a partir dali todo link
  // copiado daquela aba levava o .html adiante.
  function limparEndereco() {
    if (!/\.html$/i.test(location.pathname)) return;
    var limpo = location.pathname.replace(/\/index\.html$/i, "/")
                                 .replace(/\.html$/i, "");
    try {
      history.replaceState(history.state, "", limpo + location.search + location.hash);
    } catch (e) { /* navegador antigo: fica como esta, e funciona igual */ }
  }
  limparEndereco();

  // Libera a tela de carregamento.
  //
  // Quem controla a espera e o app.js, porque as telas pedem para ele esperar
  // por leituras. Mas duas telas nao carregam app.js - a confirmacao do codigo
  // e a de sem acesso - e nelas a saida precisa acontecer daqui, senao a pessoa
  // fica olhando o logo para sempre.
  function liberarTela() {
    if (window.App && App.telaPronta) { App.telaPronta(); return; }
    var el = document.getElementById("tela-carregando");
    if (!el) return;
    el.style.opacity = "0";
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 260);
  }
  // Rede lenta ou erro nao previsto nao podem prender ninguem atras do logo.
  setTimeout(liberarTela, 7000);

  // Guard automático (todas as páginas do app; login fica de fora)
  var arq = arquivoAtual();
  if (MAPA_PAGINAS[arq]) {
    var rodar = function () {
      ligarSair();
      ligarVoltarInicio();
      // Erro na montagem nao pode deixar a tela pela metade em silencio: sem
      // isto, quebrar aqui virava "Uncaught (in promise)" e a pessoa ficava com
      // o menu sem filtro e sem saber de nada.
      var r = guard(MAPA_PAGINAS[arq]);
      if (r && r.catch) {
        r.catch(function (e) {
          if (window.console && console.error) console.error("guard", e);
        });
      }
      // A tela de carregamento so sai depois desta decisao: e aqui que o menu
      // e filtrado. Sair antes mostraria, por um instante, itens que aquele
      // cargo nao alcanca.
      //
      // Nos desvios (sem sessao, sem permissao, falta o codigo) a tela NAO
      // aparece: a pagina esta de saida, e mostrar o conteudo por um quadro
      // antes de trocar e o piscar que se quer tirar.
      if (r && r.then) {
        var DESVIOS = ["sem-sessao", "sem-permissao", "precisa-codigo", "sem-acesso"];
        r.then(function (saida) {
          if (DESVIOS.indexOf(saida) < 0) liberarTela();
        }, function () {
          // Falhou: melhor a tela como estiver do que ninguem preso no logo.
          liberarTela();
        });
      } else {
        liberarTela();
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", rodar);
    } else {
      rodar();
    }
  } else {
    // Tela sem guard (entrada, sem acesso, confirmacao do codigo): nao ha
    // permissao para esperar, entao ela aparece assim que o documento existe.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", liberarTela);
    } else {
      liberarTela();
    }
  }

  window.Auth = {
    cliente: client,
    pronto: !!PRONTO,
    guard: guard,
    sessao: sessao,
    perfil: perfil,
    entrarMicrosoft: entrarMicrosoft,
    formasDeEntrar: formasDeEntrar,
    pedirCodigoDeEntrada: pedirCodigoDeEntrada,
    entrarComCodigo: entrarComCodigo,
    entrarDemo: entrarDemo,
    telas: telas,
    podeTela: podeTela,
    telaInicial: telaInicial,
    verComo: verComo,
    definirVerComo: definirVerComo,
    sair: sair,
    modoDemo: modoDemo,
    papelDemo: papelDemo,
    mfaSituacao: mfaSituacao,
    mfaEnviarCodigo: mfaEnviarCodigo,
    mfaConfirmar: mfaConfirmar
  };
})();
