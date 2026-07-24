/* =========================================================================
   Auditoria de EPOs - shell de navegação + helpers.
   window.App  -> helpers puros consumidos pelas telas.
   window.Layout.mount() -> injeta sidebar + topbar.
   Depende de window.APP (assets/data.js), carregado ANTES deste arquivo.
   ========================================================================= */
(function () {
  "use strict";

  var DATA = window.APP || {};

  // -----------------------------------------------------------------------
  // Navegação fixa (5 itens).
  // -----------------------------------------------------------------------
  var NAV = [
    { key: "geral",      label: "Visão geral",    icon: "ti-layout-dashboard", href: "index.html" },
    { key: "ranking",    label: "Ranking",        icon: "ti-trophy",           href: "ranking.html" },
    { key: "comparativo", label: "Comparativo",   icon: "ti-arrows-diff",      href: "comparar.html" },
    { key: "auditoria",  label: "Nova auditoria", icon: "ti-clipboard-check",  href: "auditoria.html" },
    { key: "evidencias", label: "Evidências",     icon: "ti-camera",           href: "evidencias.html" },
    { key: "config",     label: "Configurações",  icon: "ti-settings",         href: "configuracoes.html" }
  ];

  // -----------------------------------------------------------------------
  // Formatação pt-BR
  // -----------------------------------------------------------------------
  function fmtNum(n) {
    if (n === null || n === undefined || isNaN(n)) return "-";
    return Number(n).toLocaleString("pt-BR");
  }

  function fmtDias(n) {
    if (n === null || n === undefined || isNaN(n)) return "-";
    var s = Number(n).toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
    return s + " d";
  }

  function fmtPct(n) {
    if (n === null || n === undefined || isNaN(n)) return "-";
    return Math.round(Number(n)) + "%";
  }

  // -----------------------------------------------------------------------
  // Tiers
  // -----------------------------------------------------------------------
  function tierOf(score) {
    var rules = DATA.tierRules || { ouroMin: 85, prataMin: 70, bronzeMin: 50 };
    if (score >= rules.ouroMin) return "ouro";
    if (score >= rules.prataMin) return "prata";
    if (score >= (rules.bronzeMin != null ? rules.bronzeMin : 50)) return "bronze";
    return "critico";
  }

  var TIER_META = {
    ouro:    { label: "Ouro",    cls: "badge-ouro",    color: "var(--ouro)" },
    prata:   { label: "Prata",   cls: "badge-prata",   color: "var(--prata)" },
    bronze:  { label: "Bronze",  cls: "badge-bronze",  color: "var(--bronze)" },
    critico: { label: "Crítico", cls: "badge-critico", color: "var(--critico)" }
  };

  function tierMeta(tier) {
    return TIER_META[tier] || TIER_META.critico;
  }

  // -----------------------------------------------------------------------
  // Gravidade das não-conformidades
  // -----------------------------------------------------------------------
  var GRAVIDADE_META = {
    alta:  { label: "Alta",  cls: "badge-alta" },
    media: { label: "Média", cls: "badge-media" },
    baixa: { label: "Baixa", cls: "badge-baixa" }
  };

  function badgeGravidade(g) {
    return GRAVIDADE_META[g] || GRAVIDADE_META.baixa;
  }

  // -----------------------------------------------------------------------
  // Consultas
  // -----------------------------------------------------------------------
  function epoById(id) {
    var list = DATA.epos || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function getParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (e) {
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // Toast (canto inferior direito, some em ~2,5s)
  // -----------------------------------------------------------------------
  function toast(msg) {
    var host = document.getElementById("toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      host.className = "toast-host";
      document.body.appendChild(host);
    }
    var el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    el.innerHTML =
      '<i class="ti ti-circle-check" aria-hidden="true"></i><span>' +
      escapeHtml(msg) +
      "</span>";
    host.appendChild(el);
    // força reflow para animação de entrada
    void el.offsetWidth;
    el.classList.add("is-visible");
    setTimeout(function () {
      el.classList.remove("is-visible");
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 240);
    }, 2500);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // -----------------------------------------------------------------------
  // window.App
  // -----------------------------------------------------------------------
  window.App = {
    NAV: NAV,
    tierOf: tierOf,
    tierMeta: tierMeta,
    fmtDias: fmtDias,
    fmtPct: fmtPct,
    fmtNum: fmtNum,
    epoById: epoById,
    getParam: getParam,
    toast: toast,
    badgeGravidade: badgeGravidade,
    escapeHtml: escapeHtml
  };

  // -----------------------------------------------------------------------
  // window.Layout - shell (sidebar + topbar)
  // -----------------------------------------------------------------------
  function buildSidebar(activeKey) {
    var items = NAV.map(function (n) {
      var active = n.key === activeKey ? " active" : "";
      var ariaCurrent = n.key === activeKey ? ' aria-current="page"' : "";
      return (
        '<a class="nav-item' + active + '" href="' + n.href + '"' + ariaCurrent + ">" +
        '<i class="ti ' + n.icon + '" aria-hidden="true"></i>' +
        '<span class="nav-label">' + n.label + "</span>" +
        "</a>"
      );
    }).join("");

    return (
      '<a class="sidebar-logo" href="index.html" aria-label="APSIS - Auditoria de EPOs">' +
        '<span class="sidebar-logo-pill"><img src="https://ybixbsfmxblaippubtvw.supabase.co/storage/v1/object/public/assets/logo_com_nome.png" alt="APSIS"></span>' +
        '<span class="sidebar-logo-mini" aria-hidden="true">A</span>' +
      "</a>" +
      '<button class="sidebar-collapse" id="sidebar-collapse" type="button" aria-label="Recolher menu"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>' +
      '<nav class="nav" aria-label="Navegação principal">' + items + "</nav>" +
      '<div class="sidebar-user">' +
        '<span class="sidebar-user-avatar"><i class="ti ti-user" aria-hidden="true"></i></span>' +
        '<span class="sidebar-user-label">Minha conta</span>' +
      "</div>"
    );
  }

  function buildTopbar(title, actionsHTML) {
    return (
      '<div class="topbar-left">' +
        '<button class="topbar-menu" id="topbar-menu" type="button" aria-label="Abrir navegação"><i class="ti ti-menu-2" aria-hidden="true"></i></button>' +
        '<span class="topbar-bar" aria-hidden="true"></span>' +
        '<div class="topbar-titles">' +
          '<h1 class="topbar-title">' + escapeHtml(title) + '</h1>' +
          '<p class="topbar-subtitle">Auditoria de EPOs</p>' +
        '</div>' +
      '</div>' +
      '<div class="topbar-actions">' +
        (actionsHTML || "") +
        '<button class="topbar-bell" type="button" aria-label="Notificações"><i class="ti ti-bell" aria-hidden="true"></i><span class="dot"></span></button>' +
        '<button class="avatar-btn" id="user-menu-btn" type="button" aria-label="Conta" aria-haspopup="true"><i class="ti ti-user" aria-hidden="true"></i></button>' +
        '<div class="user-menu" id="user-menu" role="menu">' +
          '<div class="user-menu-head"><p class="nm">Ana Ribeiro</p><p class="em">ana.ribeiro@apsis.com.br</p></div>' +
          '<a class="user-menu-item" href="login.html" role="menuitem"><i class="ti ti-logout" aria-hidden="true"></i>Sair</a>' +
        '</div>' +
      '</div>'
    );
  }

  function mount(activeKey, title, actionsHTML) {
    var sidebar = document.getElementById("sidebar");
    var topbar = document.getElementById("topbar");
    if (sidebar) sidebar.innerHTML = buildSidebar(activeKey);
    if (topbar) topbar.innerHTML = buildTopbar(title, actionsHTML);

    if (title) document.title = title + " - Auditoria de EPOs";

    // Toggle da sidebar no mobile (com backdrop)
    var menuBtn = document.getElementById("topbar-menu");
    if (menuBtn && sidebar) {
      var backdrop = document.querySelector(".sidebar-backdrop");
      if (!backdrop) {
        backdrop = document.createElement("div");
        backdrop.className = "sidebar-backdrop";
        document.body.appendChild(backdrop);
      }
      var setOpen = function (open) {
        sidebar.classList.toggle("is-open", open);
        backdrop.classList.toggle("is-open", open);
      };
      menuBtn.addEventListener("click", function () {
        setOpen(!sidebar.classList.contains("is-open"));
      });
      backdrop.addEventListener("click", function () { setOpen(false); });
      // fecha ao navegar / clicar em item
      sidebar.addEventListener("click", function (ev) {
        if (ev.target.closest(".nav-item")) setOpen(false);
      });
    }

    // Recolher/expandir a sidebar (desktop) - estado persistido
    var collapseBtn = document.getElementById("sidebar-collapse");
    if (collapseBtn && sidebar) {
      var applyCollapsed = function (c) {
        sidebar.classList.toggle("is-collapsed", c);
        var ic = collapseBtn.querySelector("i");
        if (ic) ic.className = "ti " + (c ? "ti-chevron-right" : "ti-chevron-left");
        collapseBtn.setAttribute("aria-label", c ? "Expandir menu" : "Recolher menu");
        try { localStorage.setItem("epoSidebarCollapsed", c ? "1" : "0"); } catch (e) {}
      };
      var savedCollapsed = false;
      try { savedCollapsed = localStorage.getItem("epoSidebarCollapsed") === "1"; } catch (e) {}
      applyCollapsed(savedCollapsed);
      collapseBtn.addEventListener("click", function () {
        applyCollapsed(!sidebar.classList.contains("is-collapsed"));
      });
    }

    // Menu de conta (topbar)
    var userBtn = document.getElementById("user-menu-btn");
    var userMenu = document.getElementById("user-menu");
    if (userBtn && userMenu) {
      userBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        userMenu.classList.toggle("open");
      });
      document.addEventListener("click", function (ev) {
        if (!userMenu.contains(ev.target) && ev.target !== userBtn) {
          userMenu.classList.remove("open");
        }
      });
    }
  }

  window.Layout = { mount: mount };
})();
