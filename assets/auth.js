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
    var ordem = ["geral", "pendentes", "auditoria", "envio", "checagem", "giro", "ranking", "comparativo", "gerencial", "alocacoes", "evidencias", "config", "acessos"];
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
        return r.data || { nome: user.email, papel: "auditor", cliente_id: null };
      });
  }

  // Se o e-mail ganhou alocação depois de já ter conta, promove a 'responsavel'
  var papelSincronizado = false;
  function sincronizarPapel() {
    if (papelSincronizado || !client) return Promise.resolve();
    papelSincronizado = true;
    return client.rpc("sincronizar_papel_responsavel").then(function () {}, function () {});
  }

  // ---------------------------------------------------------------- Login
  function entrarMicrosoft() {
    if (!client) return Promise.reject(new Error("Supabase não configurado."));
    return client.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "email openid profile",
        redirectTo: location.origin + location.pathname.replace(/login\.html.*$/, "") + "index.html"
      }
    });
  }

  function enviarCodigo(email) {
    if (!client) return Promise.reject(new Error("Supabase não configurado."));
    return client.auth.signInWithOtp({
      email: email,
      options: { shouldCreateUser: true }
    });
  }

  function verificarCodigo(email, token) {
    if (!client) return Promise.reject(new Error("Supabase não configurado."));
    return client.auth.verifyOtp({ email: email, token: token, type: "email" });
  }

  function sair() {
    try { sessionStorage.removeItem("epoDemo"); } catch (e) {}
    var fim = function () { location.replace("login.html"); };
    if (!client) { fim(); return; }
    client.auth.signOut().then(fim).catch(fim);
  }

  function entrarDemo() {
    try { sessionStorage.setItem("epoDemo", "1"); } catch (e) {}
    location.href = "index.html";
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
      atualizarUi({ nome: "Modo demonstração", email: "sem login · dados fictícios", papel: "demo" });
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
    entrarMicrosoft: entrarMicrosoft,
    enviarCodigo: enviarCodigo,
    verificarCodigo: verificarCodigo,
    entrarDemo: entrarDemo,
    sair: sair,
    modoDemo: modoDemo
  };
})();
