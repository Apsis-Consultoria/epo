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

  // Página -> chave de permissão (mesmas chaves de APP.papeisPreset)
  var MAPA_PAGINAS = {
    "epos.html": "epos",
    "index.html": "geral",
    "ranking.html": "ranking",
    "comparar.html": "comparativo",
    "gerencial.html": "gerencial",
    "pendentes.html": "pendentes",
    "auditoria.html": "auditoria",
    "envio.html": "envio",
    "checagem.html": "checagem",
    "alocacoes.html": "alocacoes",
    "contagem-giro.html": "giro",
    "evidencias.html": "evidencias",
    "configuracoes.html": "config",
    "acessos.html": "acessos"
  };

  // Primeira página permitida do papel (destino padrão pós-login/negado)
  function primeiraPermitida(perms) {
    var ordem = ["geral", "epos", "pendentes", "auditoria", "envio", "checagem", "giro", "ranking", "comparativo", "gerencial", "alocacoes", "evidencias", "config", "acessos"];
    var mapaInverso = {};
    Object.keys(MAPA_PAGINAS).forEach(function (arq) { mapaInverso[MAPA_PAGINAS[arq]] = arq; });
    for (var i = 0; i < ordem.length; i++) {
      if (!perms || perms[ordem[i]] !== false) return mapaInverso[ordem[i]] || "index.html";
    }
    return "login.html";
  }

  // Esconde itens do menu sem permissão para o papel
  function filtrarNav(perms) {
    if (!perms) return;
    Object.keys(MAPA_PAGINAS).forEach(function (arq) {
      var key = MAPA_PAGINAS[arq];
      if (perms[key] === false) {
        document.querySelectorAll('.nav a[href="' + arq + '"], .nav a[href^="' + arq + '?"]').forEach(function (el) { el.style.display = "none"; });
        if (key === "auditoria") {
          document.querySelectorAll('.nav-parent[data-subnav="auditoria"], .nav-sub[data-subnav-panel="auditoria"]').forEach(function (el) { el.style.display = "none"; });
        }
      }
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
    mostra("envio", !pendentes && perms.envio !== false);
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
    responsavel: "Responsável da EPO (teste)",
    cliente: "Gerente Claro (teste)",
    auditor: "Consultor APSIS (teste)"
  };

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
        return r.data || { nome: user.email, papel: "auditor", cliente_id: null };
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

  // Se o e-mail ganhou alocação depois de já ter conta, promove a 'responsavel'
  var papelSincronizado = false;
  function sincronizarPapel() {
    if (papelSincronizado || !client) return Promise.resolve();
    papelSincronizado = true;
    return client.rpc("sincronizar_papel_responsavel").then(function () {}, function () {});
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
  function entrarComSenha(email, senha) {
    if (!client) return Promise.reject(new Error("Login indisponível no momento."));
    return client.auth.signInWithPassword({ email: email, password: senha });
  }

  // Manda o link para definir ou redefinir a senha. Serve para o "esqueci minha
  // senha" e para quem nunca definiu a dele.
  function pedirLinkDeSenha(email) {
    if (!client) return Promise.reject(new Error("Login indisponível no momento."));
    return client.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + location.pathname.replace(/[^/]*$/, "") + "definir-senha.html"
    });
  }

  function sair() {
    try {
      sessionStorage.removeItem("epoDemo");
      sessionStorage.removeItem("epoDemoPapel");
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
    // Sair: encerra a sessão de verdade
    var sairLink = document.querySelector('.user-menu a[href="login.html"]');
    if (sairLink && !sairLink.dataset.authWired) {
      sairLink.dataset.authWired = "1";
      sairLink.addEventListener("click", function (ev) {
        ev.preventDefault();
        sair();
      });
    }
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
      // Sem Supabase carregado (ex.: offline): mantém protótipo utilizável
      return Promise.resolve("offline");
    }
    return sessao().then(function (s) {
      if (!s) { location.replace("login.html"); return "sem-sessao"; }
      return sincronizarPapel().then(function () {
        return perfilDe(s.user);
      }).then(function (p) {
        // Recebeu acesso e ainda não escolheu a senha: define primeiro.
        if (p.senha_provisoria) {
          location.replace("definir-senha.html");
          return "definir-senha";
        }
        var mapa = (window.APP && window.APP.papeisPreset) || {};
        var perms = mapa[p.papel];
        if (perms && pageKey && perms[pageKey] === false) {
          location.replace(primeiraPermitida(perms));
          return "sem-permissao";
        }
        atualizarUi({ nome: p.nome, email: s.user.email, papel: p.papel });
        filtrarNav(perms);
        return "ok";
      });
    });
  }

  // Guard automático (todas as páginas do app; login.html fica de fora)
  var arq = arquivoAtual();
  if (MAPA_PAGINAS[arq]) {
    var rodar = function () { guard(MAPA_PAGINAS[arq]); };
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
    sair: sair,
    modoDemo: modoDemo,
    papelDemo: papelDemo
  };
})();
