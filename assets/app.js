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
  // Navegação. Não existe mais "abrir auditoria quando quiser": a auditoria
  // sempre nasce de um pedido feito na criação da EPO e é preenchida a partir
  // de "Auditorias pendentes". A contagem da reversa é a exceção: é operacional,
  // feita pelo técnico no momento em que a devolução chega do campo.
  // -----------------------------------------------------------------------
  var NAV = [
    { key: "geral",       label: "Visão geral",      icon: "ti-layout-dashboard", href: "index.html" },
    { key: "epos",        label: "EPOs",             icon: "ti-building-warehouse", href: "epos.html" },
    { key: "cronograma",  label: "Cronograma",       icon: "ti-calendar-stats",   href: "cronograma.html" },
    { key: "ranking",     label: "Ranking",          icon: "ti-trophy",           href: "ranking.html" },
    { key: "comparativo", label: "Comparativo",      icon: "ti-arrows-diff",      href: "comparar.html" },
    { key: "gerencial",   label: "Painel gerencial", icon: "ti-report-analytics", href: "gerencial.html" },
    { key: "pendentes",   label: "Auditorias pendentes", icon: "ti-clipboard-list", href: "pendentes.html" },
    { key: "realizadas",  label: "Auditorias realizadas", icon: "ti-clipboard-check", href: "realizadas.html" },
    // Uma tela so para evidencia. Cada lado anexa na propria caixa, na mesma
    // tela onde ve o que os outros mandaram. Antes havia uma tela separada so
    // para enviar, e quem enviava nao via o resto.
    { key: "checagem",    label: "Evidências",       icon: "ti-photo-check",      href: "checagem.html" },
    { key: "giro",        label: "Contagem Logística Reversa", icon: "ti-packages", href: "contagem-giro.html" },
    // Reenvio, acessos e arquivos são bastidores: quem opera o dia a dia
    // não passa por eles. Ficam como subtópicos de Configurações.
    // Configuracoes nao tem tela propria: e so o agrupador que abre as de
    // baixo. Clicar no titulo de uma secao e abrir uma pagina que repete os
    // proprios subtopicos nao leva a pessoa a lugar nenhum.
    { key: "config",      label: "Configurações",    icon: "ti-settings",
      children: [
        { key: "questionarios", label: "Questionários",          href: "questionarios.html" },
        { key: "alocacoes",  label: "Reenvio de checklist",     href: "alocacoes.html" },
        { key: "acessos",    label: "Gerenciamento de acessos", href: "acessos.html" },
        { key: "evidencias", label: "Evidências enviadas",      href: "evidencias.html" }
      ] }
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
  // Tiers (selos)
  // -----------------------------------------------------------------------
  function tierOf(score) {
    var rules = DATA.tierRules || { ouroMin: 85, prataMin: 70, bronzeMin: 55 };
    if (score >= rules.ouroMin) return "ouro";
    if (score >= rules.prataMin) return "prata";
    if (score >= (rules.bronzeMin != null ? rules.bronzeMin : 55)) return "bronze";
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
  // Origem da evidência. Três lados enviam documento do mesmo questionário:
  // a Claro, a APSIS em campo e a EPO terceirizada. A cor separa quem mandou
  // o quê sem precisar ler rótulo.
  // -----------------------------------------------------------------------
  var ORIGEM_META = {
    claro:     { label: "Evidências Claro", curto: "Claro", cls: "origem-claro", icon: "ti-antenna-bars-5" },
    consultor: { label: "Evidências APSIS", curto: "APSIS", cls: "origem-apsis", icon: "ti-clipboard-check" },
    epo:       { label: "Evidências EPO",   curto: "EPO",   cls: "origem-epo",   icon: "ti-building-warehouse" }
  };
  var ORIGEM_ORDEM = ["claro", "consultor", "epo"];

  function origemMeta(chave) {
    return ORIGEM_META[chave] || ORIGEM_META.epo;
  }

  // Abrir a evidência que os outros enviaram: imagem e PDF o navegador mostra
  // em outra aba; planilha e documento ele baixa. Sem isso o auditor no celular
  // fica olhando um nome de arquivo sem conseguir ver o conteúdo.
  function abrirEvidencia(url, nome) {
    if (!url) return false;
    var ext = String(nome || url).toLowerCase().split("?")[0].split(".").pop();
    var noNavegador = /^(pdf|png|jpe?g|gif|webp|bmp|avif|svg|txt)$/.test(ext);
    if (noNavegador) {
      window.open(url, "_blank", "noopener");
      return true;
    }
    // Planilha, documento, zip: baixa em vez de abrir uma aba em branco.
    var a = document.createElement("a");
    a.href = url;
    a.download = nome || "";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
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

  function processoById(id) {
    var list = DATA.processos || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    if (DATA.checklistCarregadores && DATA.checklistCarregadores.id === id) {
      return DATA.checklistCarregadores;
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

  // -----------------------------------------------------------------------
  // Confirmação. O aviso do navegador escreve o endereço do site na frente da
  // pergunta e usa os botões dele; aqui a pergunta é do sistema.
  //
  // App.confirmar({ titulo, texto, confirmar, cancelar, perigo }) -> Promise
  // O texto aceita linha em branco para separar parágrafos.
  // -----------------------------------------------------------------------
  function confirmar(opcoes) {
    var o = opcoes || {};

    var corpo = String(o.texto == null ? "" : o.texto)
      .split(/\n{2,}/)
      .map(function (par) {
        return "<p>" + escapeHtml(par).replace(/\n/g, "<br>") + "</p>";
      }).join("");

    return new Promise(function (resolve) {
      var overlay = document.createElement("div");
      overlay.className = "modal-overlay confirmar-overlay";
      overlay.innerHTML =
        '<div class="modal confirmar-modal" role="dialog" aria-modal="true" aria-labelledby="confirmar-titulo">' +
          '<div class="modal-header">' +
            '<h2 class="modal-title" id="confirmar-titulo">' + escapeHtml(o.titulo || "Confirmar") + "</h2>" +
            '<button class="modal-close" type="button" data-resposta="0" aria-label="Fechar">' +
              '<i class="ti ti-x" aria-hidden="true"></i>' +
            "</button>" +
          "</div>" +
          '<div class="modal-body"><div class="confirmar-texto">' + corpo + "</div></div>" +
          '<div class="modal-footer">' +
            '<button class="btn btn-ghost" type="button" data-resposta="0">' +
              escapeHtml(o.cancelar || "Cancelar") +
            "</button>" +
            '<button class="btn ' + (o.perigo ? "btn-danger" : "btn-primary") + '" type="button" data-resposta="1">' +
              escapeHtml(o.confirmar || "Confirmar") +
            "</button>" +
          "</div>" +
        "</div>";
      document.body.appendChild(overlay);
      void overlay.offsetWidth;             // reflow: a entrada precisa animar
      overlay.classList.add("is-open");

      var focoAnterior = document.activeElement;
      var botoes = overlay.querySelectorAll("[data-resposta]");
      var confirmarBtn = botoes[botoes.length - 1];
      // O overlay entra invisível e só aparece com a transição; focar antes
      // disso não pega. Um tique depois, pega.
      setTimeout(function () { confirmarBtn.focus(); }, 60);

      var vivo = true;
      function fechar(resposta) {
        if (!vivo) return;
        vivo = false;
        document.removeEventListener("keydown", noTeclado, true);
        overlay.classList.remove("is-open");
        setTimeout(function () {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
        }, 180);
        resolve(resposta);
      }

      // Esc cancela. Enter não precisa de tratamento: o botão em foco já
      // responde a ele, e a tela por trás não recebe a tecla.
      function noTeclado(ev) {
        if (ev.key === "Escape") { ev.stopPropagation(); fechar(false); }
      }

      Array.prototype.forEach.call(botoes, function (b) {
        b.addEventListener("click", function () {
          fechar(b.getAttribute("data-resposta") === "1");
        });
      });
      overlay.addEventListener("click", function (ev) {
        if (ev.target === overlay) fechar(false);
      });
      document.addEventListener("keydown", noTeclado, true);
    });
  }

  // -----------------------------------------------------------------------
  // Documento aberto quando o anexo não tem arquivo baixável associado.
  // Monta uma página com o nome do arquivo e abre por blob, para o clique
  // nunca terminar em erro ou em aviso.
  // -----------------------------------------------------------------------
  var cacheDoc = {};

  function documentoDe(nome) {
    var chave = String(nome || "documento");
    if (cacheDoc[chave]) return cacheDoc[chave];

    var linhas = "";
    var larguras = [512, 468, 496, 430, 372, 505, 448, 296, 470, 410];
    var y = 214;
    for (var i = 0; i < larguras.length; i++) {
      linhas += '<rect x="56" y="' + y + '" width="' + larguras[i] + '" height="11" rx="5.5" fill="#E7EBE8"/>';
      y += 30;
    }

    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="620" height="877" viewBox="0 0 620 877">' +
        '<rect width="620" height="877" fill="#FFFFFF"/>' +
        '<rect width="620" height="7" fill="#1A4731"/>' +
        '<text x="56" y="104" font-family="Inter, Segoe UI, sans-serif" font-size="21" font-weight="700" fill="#1A2B1F">' +
          escapeHtml(chave) +
        "</text>" +
        '<rect x="56" y="132" width="90" height="4" rx="2" fill="#F47920"/>' +
        '<rect x="56" y="168" width="248" height="11" rx="5.5" fill="#DDE3DE"/>' +
        linhas +
        '<rect x="56" y="548" width="508" height="150" rx="10" fill="none" stroke="#DDE3DE" stroke-width="1.5"/>' +
        '<rect x="80" y="580" width="180" height="11" rx="5.5" fill="#E7EBE8"/>' +
        '<rect x="80" y="612" width="320" height="11" rx="5.5" fill="#E7EBE8"/>' +
        '<rect x="80" y="644" width="256" height="11" rx="5.5" fill="#E7EBE8"/>' +
      "</svg>";

    var url = svg;
    try {
      url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    } catch (e) {
      url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }
    cacheDoc[chave] = url;
    return url;
  }

  function abrirDocumento(nome) {
    window.open(documentoDe(nome), "_blank", "noopener");
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
    processoById: processoById,
    getParam: getParam,
    toast: toast,
    confirmar: confirmar,
    ORIGENS: ORIGEM_ORDEM,
    origemMeta: origemMeta,
    abrirEvidencia: abrirEvidencia,
    badgeGravidade: badgeGravidade,
    escapeHtml: escapeHtml,
    documentoDe: documentoDe,
    abrirDocumento: abrirDocumento
  };

  // -----------------------------------------------------------------------
  // window.Layout - shell (sidebar + topbar)
  // -----------------------------------------------------------------------
  // Aberto ou fechado fica guardado por secao. Sem isso, fechar Configuracoes
  // duraria ate a proxima tela: o menu e remontado em cada pagina.
  function secaoAberta(key) {
    try {
      var v = localStorage.getItem("epoNavSecao:" + key);
      return v === null ? true : v === "1";   // sem escolha ainda, abre
    } catch (e) {
      return true;
    }
  }

  function guardarSecao(key, aberta) {
    try { localStorage.setItem("epoNavSecao:" + key, aberta ? "1" : "0"); } catch (e) {}
  }

  function buildSidebar(activeKey) {
    var processoAtivo = activeKey === "auditoria" ? getParam("processo") : null;

    var items = NAV.map(function (n) {
      var isActive = n.key === activeKey;

      // Seção com subtópicos: o pai continua sendo um link (a tela dele existe)
      // e os filhos aparecem quando a seção está em uso.
      if (n.children && n.children.length) {
        var filhoAtivo = false;
        var kids = n.children.map(function (c) {
          var cAtivo = c.key === activeKey || (processoAtivo && processoAtivo === c.key);
          if (cAtivo) filhoAtivo = true;
          return (
            '<a class="nav-sub-item' + (cAtivo ? " active" : "") + '" href="' + c.href + '"' +
              (cAtivo ? ' aria-current="page"' : "") + ">" +
            '<span class="nav-sub-label">' + escapeHtml(c.label) + "</span>" +
            "</a>"
          );
        }).join("");
        // Secao sem tela propria e um botao que abre e fecha, nao um link:
        // antes era um rotulo morto, e quem clicava nao via nada acontecer.
        // Com filho ativo o painel abre a forca: esconder a tela em que a
        // pessoa esta da a impressao de que ela sumiu do menu.
        var aberto = filhoAtivo || secaoAberta(n.key);
        var idPainel = "subnav-" + n.key;
        var cabeca = n.href
          ? '<a class="nav-item' + (isActive || filhoAtivo ? " active" : "") + '" href="' + n.href + '"' +
              (isActive ? ' aria-current="page"' : "") + ">" +
              '<i class="ti ' + n.icon + '" aria-hidden="true"></i>' +
              '<span class="nav-label">' + n.label + "</span>" +
            "</a>"
          : '<button type="button" class="nav-item nav-parent' + (filhoAtivo ? " active" : "") + '" ' +
              'data-subnav="' + n.key + '" aria-expanded="' + (aberto ? "true" : "false") + '" ' +
              'aria-controls="' + idPainel + '">' +
              '<i class="ti ' + n.icon + '" aria-hidden="true"></i>' +
              '<span class="nav-label">' + n.label + "</span>" +
              '<i class="ti ti-chevron-down nav-caret" aria-hidden="true"></i>' +
            "</button>";
        return (
          cabeca +
          '<div class="nav-sub' + (aberto ? " is-open" : "") + '" id="' + idPainel + '" ' +
            'data-subnav-panel="' + n.key + '">' + kids + "</div>"
        );
      }

      var active = isActive ? " active" : "";
      var ariaCurrent = isActive ? ' aria-current="page"' : "";
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
      '<div class="sidebar-brand" aria-hidden="true"><img src="assets/brand/logo-claro-branco-rocket.png" alt="APSIS"></div>' +
      '<div class="sidebar-user">' +
        '<span class="sidebar-user-avatar"><i class="ti ti-user" aria-hidden="true"></i></span>' +
        '<span class="sidebar-user-label">Minha conta</span>' +
      "</div>"
    );
  }

  // Barra inferior (só mobile), no padrão do Gmail: dois atalhos fixos.
  // 1) preencher: "Auditorias pendentes" para a equipe APSIS ou "Evidências"
  //    para o responsável da EPO, que é onde ele anexa (auth.js troca conforme
  //    a permissão do papel, mantendo sempre dois botões).
  // 2) montagem de estoque: contagem dos itens que chegam na EPO.
  var BOTTOM = [
    { key: "pendentes", label: "Auditorias", icon: "ti-clipboard-list",  href: "pendentes.html" },
    { key: "checagem",  label: "Evidências", icon: "ti-photo-check",     href: "checagem.html", oculto: true },
    { key: "giro",      label: "Contagem",   icon: "ti-packages",        href: "contagem-giro.html" }
  ];

  function buildBottombar(activeKey) {
    return BOTTOM.map(function (b) {
      var ativo = b.key === activeKey ? " active" : "";
      return (
        '<a class="bottombar-item' + ativo + '" href="' + b.href + '" data-bb="' + b.key + '"' +
          (b.oculto ? ' style="display:none;"' : "") +
          (ativo ? ' aria-current="page"' : "") + ">" +
          '<i class="ti ' + b.icon + '" aria-hidden="true"></i>' +
          "<span>" + b.label + "</span>" +
        "</a>"
      );
    }).join("");
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
          // Sem nome escrito aqui. Havia uma pessoa inventada neste lugar, e
          // quando o carregamento do perfil falhava ela ficava na tela como se
          // fosse quem tinha entrado. Nome de gente vem do cadastro, sempre.
          '<div class="user-menu-head"><p class="nm"></p><p class="em"></p></div>' +
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

    // Barra inferior no mobile (o CSS a esconde no desktop)
    var shell = document.querySelector(".app-shell");
    if (shell && !document.querySelector(".bottombar")) {
      var bb = document.createElement("nav");
      bb.className = "bottombar";
      bb.setAttribute("aria-label", "Atalhos");
      bb.innerHTML = buildBottombar(activeKey);
      shell.appendChild(bb);
      shell.classList.add("has-bottombar");
    }

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
      // fecha ao navegar (apenas links; o pai do submenu não navega)
      sidebar.addEventListener("click", function (ev) {
        if (ev.target.closest("a.nav-item, a.nav-sub-item")) setOpen(false);
      });
    }

    // Submenu (se algum item ganhar filhos): o clique no pai expande, nao navega.
    if (sidebar) {
      sidebar.addEventListener("click", function (ev) {
        var parent = ev.target.closest(".nav-parent");
        if (!parent) return;
        // No estado recolhido (desktop), o submenu não expande.
        var desktop = window.matchMedia("(min-width: 901px)").matches;
        if (desktop && sidebar.classList.contains("is-collapsed")) return;
        var key = parent.getAttribute("data-subnav");
        var panel = sidebar.querySelector('[data-subnav-panel="' + key + '"]');
        if (!panel) return;
        var open = !panel.classList.contains("is-open");
        panel.classList.toggle("is-open", open);
        parent.setAttribute("aria-expanded", open ? "true" : "false");
        guardarSecao(key, open);
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
