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
      "background:#8A2B06;color:#fff;font:500 13px Inter,sans-serif;text-align:center;";
    barra.textContent =
      "Sem conexão com os dados agora. Os números desta tela são de demonstração; " +
      "atualize a página quando a conexão voltar.";
    if (document.body) document.body.appendChild(barra);
    else document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(barra); });
  }

  // Página -> chave de permissão (mesmas chaves de APP.papeisPreset)
  var MAPA_PAGINAS = {
    "epos.html": "epos",
    "cronograma.html": "cronograma",
    "index.html": "geral",
    "ranking.html": "ranking",
    "comparar.html": "comparativo",
    "gerencial.html": "gerencial",
    "pendentes.html": "pendentes",
    "realizadas.html": "realizadas",
    "auditoria.html": "auditoria",
    "checagem.html": "checagem",
    "questionarios.html": "questionarios",
    "epo-detalhe.html": "ranking",
    "alocacoes.html": "alocacoes",
    "contagem-giro.html": "giro",
    "evidencias.html": "evidencias",
    "criterios-nota.html": "criterios",
    "acessos.html": "acessos"
  };

  // Primeira página permitida do papel (destino padrão pós-login/negado)
  function primeiraPermitida(perms) {
    var ordem = ["geral", "epos", "cronograma", "pendentes", "auditoria", "checagem", "giro", "ranking", "comparativo", "gerencial", "alocacoes", "evidencias", "criterios", "questionarios", "acessos"];
    var mapaInverso = {};
    Object.keys(MAPA_PAGINAS).forEach(function (arq) { mapaInverso[MAPA_PAGINAS[arq]] = arq; });
    for (var i = 0; i < ordem.length; i++) {
      if (!perms || perms[ordem[i]] !== false) return mapaInverso[ordem[i]] || "index.html";
    }
    return "login.html";
  }

  // Esconde do menu apenas o que o papel nao alcança. Fora disso o menu
  // mostra o sistema inteiro: tela que desaparece sem motivo passa a
  // impressao de que o sistema perdeu funcao.
  function filtrarNav(perms) {
    if (!perms) return;
    Object.keys(MAPA_PAGINAS).forEach(function (arq) {
      var key = MAPA_PAGINAS[arq];
      if (perms[key] === false) {
        document.querySelectorAll('.nav a[href="' + arq + '"], .nav a[href^="' + arq + '?"]').forEach(function (el) { el.style.display = "none"; });
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
    var p = location.pathname.split("/").pop();
    return p === "" ? "index.html" : p;
  }

  function modoDemo() {
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
    try {
      if (papel) sessionStorage.setItem("epoVerComo", papel);
      else sessionStorage.removeItem("epoVerComo");
    } catch (e) {}
    var presets = (window.APP && window.APP.papeisPreset) || {};
    location.href = papel ? primeiraPermitida(presets[papel]) : "index.html";
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
    return client.from("perfis").select("nome, papel, cliente_id, senha_provisoria")
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
  function sincronizarPapel() {
    if (papelSincronizado || !client) return Promise.resolve();
    papelSincronizado = true;
    return client.rpc("sincronizar_meu_acesso")
      .then(function () {}, function () {})
      .then(function () {
        return client.rpc("sincronizar_papel_responsavel").then(function () {}, function () {});
      });
  }

  // ---------------------------------------------- Telas por cargo
  // A decisao de quais telas cada cargo alcanca fica guardada no sistema e e
  // editada na tela de Gerenciamento de acessos. O padrao escrito no codigo
  // continua valendo como reserva: se a leitura falhar, o menu nao desaba.
  var promessaPermissoes = null;
  function permissoesGravadas() {
    if (promessaPermissoes) return promessaPermissoes;
    if (!client) return Promise.resolve(null);
    promessaPermissoes = client.from("permissoes_papel")
      .select("papel, tela, permitido")
      .then(function (r) {
        if (r.error || !r.data || !r.data.length) return null;
        var mapa = {};
        r.data.forEach(function (x) {
          if (!mapa[x.papel]) mapa[x.papel] = {};
          mapa[x.papel][x.tela] = !!x.permitido;
        });
        return mapa;
      })
      .catch(function () { return null; });
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
    return location.origin + location.pathname.replace(/login\.html.*$/, "") + "index.html";
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
          redirectTo: destinoPosLogin()
        }
      });
    });
  }

  // Cliente Claro e responsável da EPO: e-mail e senha. A primeira senha é
  // definida pelo próprio dono do e-mail, pelo link que ele recebe.
  // captchaToken so vai quando a tela tiver um: com o captcha desligado ele e
  // vazio e a chamada fica identica a de antes.
  function entrarComSenha(email, senha, captchaToken) {
    if (!client) return Promise.reject(new Error("Login indisponível no momento."));
    var opcoes = { email: email, password: senha };
    if (captchaToken) opcoes.options = { captchaToken: captchaToken };
    return client.auth.signInWithPassword(opcoes);
  }

  // Manda o link para definir ou redefinir a senha. Serve para o "esqueci minha
  // senha" e para quem nunca definiu a dele.
  //
  // O envio e feito por funcao nossa, e nao pelo servico de e-mail da
  // plataforma: o e-mail daquele servico chegava com o nome dela, e o link
  // nascia num formato que a pagina de definir senha nem sempre conseguia
  // trocar por sessao. Devolve { enviado, espere }: quando o pedido e recusado
  // pelo freio de um por minuto, a tela diz quanto falta em vez de afirmar que
  // enviou.
  function pedirLinkDeSenha(email, captchaToken) {
    if (!client || !client.functions || !client.functions.invoke) {
      return Promise.reject(new Error("Login indisponível no momento."));
    }
    function daResposta(d) {
      d = d || {};
      return { enviado: !!d.enviado, espere: Number(d.espere || 0) };
    }
    // O captcha do Supabase nao alcanca este caminho: o pedido de link nao passa
    // pelo servico de autenticacao, e sim pela nossa funcao. O token vai no
    // corpo e e conferido la.
    var corpo = { email: email };
    if (captchaToken) corpo.captcha = captchaToken;
    return client.functions.invoke("enviar-link-senha", { body: corpo })
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

  function sair() {
    try {
      sessionStorage.removeItem("epoDemo");
      sessionStorage.removeItem("epoDemoPapel");
      // A perspectiva escolhida em "Ver como" sobrevivia ao logout: quem
      // entrasse depois caia direto na visao de outro papel, com menos telas,
      // sem entender por que.
      sessionStorage.removeItem("epoVerComo");
    } catch (e) {}
    var fim = function () { location.replace("login.html"); };
    if (!client) { fim(); return; }
    client.auth.signOut().then(fim).catch(fim);
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
    location.href = perms ? primeiraPermitida(perms) : "index.html";
  }

  // ------------------------------------------------------------------- UI
  // Ligado assim que a tela existe, e nao depois de carregar o perfil. Estava
  // dentro de atualizarUi: quando a leitura do perfil falhava, o Sair continuava
  // sendo um link comum para login.html, ou seja, saia da tela SEM encerrar a
  // sessao - e o login, vendo sessao valida, devolvia a pessoa para dentro.
  // Sair e justamente o que tem de funcionar quando o resto falhou.
  function ligarSair() {
    var link = document.querySelector('.user-menu a[href="login.html"]');
    if (!link || link.dataset.authWired) return;
    link.dataset.authWired = "1";
    link.addEventListener("click", function (ev) {
      ev.preventDefault();
      sair();
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

    var sair = menu.querySelector('a[href="login.html"]');
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
      if (permsT) filtrarNav(permsT);
      return Promise.resolve("demo");
    }
    if (!client) {
      // Sem a biblioteca de dados (ex.: offline): a tela continua navegavel com
      // o catalogo local, mas isso precisa ficar visivel.
      avisarSemConexao();
      return Promise.resolve("offline");
    }
    return sessao().then(function (s) {
      if (!s) { location.replace("login.html"); return "sem-sessao"; }
      // Segundo fator antes de qualquer outra coisa: sem o codigo, o servidor
      // nao devolve papel nenhum, e a tela abriria vazia sem explicacao.
      return mfaSituacao().catch(function () {
        return { precisa: false };
      }).then(function (m) {
        if (m && m.precisa) {
          location.replace("confirmar-acesso.html");
          return "precisa-codigo";
        }
        return seguirComPerfil(s, pageKey);
      });
    });
  }

  // pageKey vem junto: ele e parametro de guard, e usar aqui sem receber
  // dava ReferenceError. A promessa quebrava no meio, entao o nome de quem
  // entrou nao aparecia, o menu nao era filtrado e a pessoa sem permissao
  // para a tela deixava de ser redirecionada. So acontecia em sessao de
  // verdade: em modo de teste o guard nem chega aqui, e foi por isso que
  // passou.
  function seguirComPerfil(s, pageKey) {
    var gravadas = null;
    return sincronizarPapel()
      .then(permissoesGravadas)
      .then(function (g) { gravadas = g; return perfilDe(s.user); })
      .then(function (p) {
        if (p.papel === "sem_acesso") {
          location.replace("sem-acesso.html");
          return "sem-acesso";
        }
        // Recebeu acesso e ainda não escolheu a senha: define primeiro.
        if (p.senha_provisoria) {
          location.replace("definir-senha.html");
          return "definir-senha";
        }
        var mapa = (window.APP && window.APP.papeisPreset) || {};
        var podeSimular = PAPEIS_QUE_SIMULAM.indexOf(p.papel) >= 0;
        var simulado = verComo();
        if (simulado && (!podeSimular || !mapa[simulado])) {
          // papel sem direito a simular, ou perspectiva desconhecida
          try { sessionStorage.removeItem("epoVerComo"); } catch (e) {}
          simulado = "";
        }

        var perms = permissoesDe(simulado || p.papel, gravadas);
        if (perms && pageKey && perms[pageKey] === false) {
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
        filtrarNav(perms);
        return simulado ? "ver-como" : "ok";
      });
  }

  // Guard automático (todas as páginas do app; login.html fica de fora)
  var arq = arquivoAtual();
  if (MAPA_PAGINAS[arq]) {
    var rodar = function () {
      ligarSair();
      // Erro na montagem nao pode deixar a tela pela metade em silencio: sem
      // isto, quebrar aqui virava "Uncaught (in promise)" e a pessoa ficava com
      // o menu sem filtro e sem saber de nada.
      var r = guard(MAPA_PAGINAS[arq]);
      if (r && r.catch) {
        r.catch(function (e) {
          if (window.console && console.error) console.error("guard", e);
        });
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", rodar);
    } else {
      rodar();
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
    entrarComSenha: entrarComSenha,
    pedirLinkDeSenha: pedirLinkDeSenha,
    entrarDemo: entrarDemo,
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
