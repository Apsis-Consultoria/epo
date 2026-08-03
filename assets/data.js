/* =========================================================================
   Auditoria de EPOs - dados mock (100% fictícios)
   window.APP - contrato consumido por todas as telas.

   Fluxo real do material na EPO (reunião Claro 27/07):
   chegada -> armazenagem -> distribuição ao técnico -> retorno de campo -> devolução (logística reversa)
   ========================================================================= */
(function () {
  "use strict";

  // -----------------------------------------------------------------------
  // Cliente (multi-cliente mock)
  // -----------------------------------------------------------------------
  var cliente = { id: "claro", nome: "Claro" };
  var clientes = [{ id: "claro", nome: "Claro" }];

  // -----------------------------------------------------------------------
  // Regras de classificação por selo
  // -----------------------------------------------------------------------
  var tierRules = { ouroMin: 85, prataMin: 70, bronzeMin: 55 }; // <55 = critico

  // -----------------------------------------------------------------------
  // Processos - cada um é um checklist independente. Pesos somam 100.
  // Item: { id, pergunta, evidencia, requerFoto, grave? }
  // -----------------------------------------------------------------------
  var processos = [
    {
      id: "reversa",
      nome: "Logística Reversa",
      icone: "ti-arrow-back-up",
      peso: 30,
      descricao: "Devolução do material para a Claro conforme manual",
      itens: [
        { id: "rev-01", pergunta: "Lotes no Qualitor + estados validados no Atlas", evidencia: "Qualitor; Atlas", requerFoto: false },
        { id: "rev-02", pergunta: "NF-e espelho (J1B1N) emitida até 48h", evidencia: "J1B1N", requerFoto: false },
        { id: "rev-03", pergunta: "Packlist + NF 96h + validação BPO 24h", evidencia: "Qualitor", requerFoto: false },
        { id: "rev-04", pergunta: "Identificação correta e proteção individual", evidencia: "Manual; fotos", requerFoto: true },
        { id: "rev-05", pergunta: "Agendamento/entrega D+1", evidencia: "Agenda; canhotos", requerFoto: false },
        { id: "rev-06", pergunta: "Conferência 100% seriais (ZTC) + RNC", evidencia: "ZTC; RNC", requerFoto: false },
        { id: "rev-07", pergunta: "Devolução Bom p/ Uso - MB1C (Z42)", evidencia: "Autorização; MB1C", requerFoto: false }
      ]
    },
    {
      id: "baixas",
      nome: "Baixas - BTP / SAP / TOA",
      icone: "ti-scan",
      peso: 25,
      descricao: "Consumo do técnico lançado e baixado no sistema",
      itens: [
        { id: "bai-01", pergunta: "Baixas diárias via BTP", evidencia: "Logs BTP; MB51/MB1C; TOA", requerFoto: false },
        { id: "bai-02", pergunta: "Consumo TOA consistente com BOM", evidencia: "OS/WO; BOM", requerFoto: false }
      ]
    },
    {
      id: "armazenagem",
      nome: "Armazenagem & Facilities",
      icone: "ti-building-warehouse",
      peso: 10,
      descricao: "Guarda, segregação e condições do estoque",
      itens: [
        { id: "arm-01", pergunta: "Empilhamento/segregação/identificação corretos", evidencia: "Fotos/layout", requerFoto: true },
        { id: "arm-02", pergunta: "Área de defeitos/reversa segregada e sinalizada", evidencia: "Fotos", requerFoto: true },
        { id: "arm-03", pergunta: "Condições prediais (telhado/piso/iluminação/ergonomia) adequadas", evidencia: "Relatórios/fotos", requerFoto: true },
        { id: "arm-04", pergunta: "Integridade das embalagens checada antes da expedição", evidencia: "Check de qualidade", requerFoto: false }
      ]
    },
    {
      id: "recebimento-expedicao",
      nome: "Recebimento & Expedição",
      icone: "ti-truck-loading",
      peso: 10,
      descricao: "Chegada do material da Claro e expedição ao campo",
      itens: [
        { id: "rec-01", pergunta: "Conferência física x NF (100%) no recebimento do CD", evidencia: "NF-e, ZTC350/ZTC380, fotos", requerFoto: true },
        { id: "rec-02", pergunta: "Divergências a menor registradas com RNC e NF de diferença até D+2", evidencia: "Formulários, RNC, NF", requerFoto: false },
        { id: "rec-03", pergunta: "Divergências a maior tratadas com NF complementar até D+4", evidencia: "Formulários, NF complementar", requerFoto: false },
        { id: "rec-04", pergunta: "Expedição protegida (saco bolha), identificada e segregada de defeito/reversa", evidencia: "Fotos de staging", requerFoto: true },
        { id: "rec-05", pergunta: "Kitting completo por OS (terminais + acessórios)", evidencia: "Lista de conferência, fotos", requerFoto: true },
        { id: "rec-06", pergunta: "Triangulações aprovadas e registradas (SAP/Atlas)", evidencia: "NF triangulação, e-mails, SAP/Atlas", requerFoto: false },
        { id: "rec-07", pergunta: "Reinicializações/reusos via SharePoint com anexos padrão e comunicação ao DMT", evidencia: "SharePoint (Anexo I/II), e-mails", requerFoto: false },
        { id: "rec-08", pergunta: "Separação física entre novo, reuso e defeito (áreas distintas/sinalizadas)", evidencia: "Layout/fotos", requerFoto: true }
      ]
    },
    {
      id: "presos",
      nome: "Presos em Assinante",
      icone: "ti-home-exclamation",
      peso: 7,
      descricao: "Equipamentos retirados do cliente sem baixa",
      itens: [
        { id: "pre-01", pergunta: "Alerta quinzenal para aging > 30 dias", evidencia: "Atlas; e-mails", requerFoto: false },
        { id: "pre-02", pergunta: "Fluxo fotos 10% + Pipefy", evidencia: "Portal IN; Pipefy", requerFoto: true },
        { id: "pre-03", pergunta: "Reversa liberados + segregação presos", evidencia: "Atlas; Qualitor", requerFoto: false }
      ]
    },
    {
      id: "treinamento",
      nome: "Treinamento & Pessoas",
      icone: "ti-school",
      peso: 5,
      descricao: "Adesão do time ao Portal de treinamento",
      itens: [
        { id: "tre-01", pergunta: "100% do time no Portal (KPI1)", evidencia: "Portal", requerFoto: false }
      ]
    },
    {
      id: "governanca",
      nome: "Governança & RNCs",
      icone: "ti-shield-check",
      peso: 5,
      descricao: "Tratamento de desvios e planos de melhoria",
      itens: [
        { id: "gov-01", pergunta: "RNCs com prazos, responsáveis e eficácia", evidencia: "5W2H; RNC", requerFoto: false },
        { id: "gov-02", pergunta: "Plano de melhorias atualizado", evidencia: "Plano; 5W2H", requerFoto: false }
      ]
    },
    {
      id: "documentacao",
      nome: "Documentação & Sistemas",
      icone: "ti-files",
      peso: 8,
      descricao: "POPs, books e uso correto dos sistemas",
      itens: [
        { id: "doc-01", pergunta: "Books/POPs/manuais atualizados", evidencia: "Repositório", requerFoto: false },
        { id: "doc-02", pergunta: "Uso correto SAP/Atlas/SIAK/BTP/Qualitor", evidencia: "Prints/logs", requerFoto: false },
        { id: "doc-03", pergunta: "Checklist técnico (triagem) completo", evidencia: "Registros de triagem", requerFoto: false }
      ]
    }
  ];

  // -----------------------------------------------------------------------
  // Checklist separado - itens obrigatórios na retirada do assinante.
  // Resposta: Presente/Ausente; Ausente -> justificativa + evidência.
  // -----------------------------------------------------------------------
  var checklistCarregadores = {
    id: "carregadores",
    nome: "Itens obrigatórios na retirada",
    icone: "ti-plug",
    descricao: "Checklist separado - carregadores e itens obrigatórios na devolução do assinante",
    itens: [
      { id: "cg-01", item: "Carregador/fonte" },
      { id: "cg-02", item: "Controle remoto" },
      { id: "cg-03", item: "Cabo de energia" },
      { id: "cg-04", item: "Cabo HDMI" },
      { id: "cg-05", item: "Smart card" }
    ]
  };

  // -----------------------------------------------------------------------
  // EPOs (8) - dados fictícios e plausíveis.
  // tempos = etapas reais do fluxo; tempoCiclo = soma; tempoParada = alias.
  // reversa = indicadores de logística reversa (meta 75% fontes/controles).
  // -----------------------------------------------------------------------
  // Unidades: vem do cadastro, lidas por assets/dados-reais.js.
  // Esta lista fica VAZIA de proposito. Antes havia aqui um catalogo de
  // exemplo com nota, tempo de ciclo e historico inventados, e as telas de
  // visao geral, ranking, comparativo e gerencial mostravam aquilo como se
  // fosse o cadastro. Tela que inventa numero e pior que tela vazia.
  var epos = [];

  // -----------------------------------------------------------------------
  // Derivados por EPO: tempoCiclo (soma das 5 etapas) + alias tempoParada.
  // -----------------------------------------------------------------------
  function round1(n) { return Math.round(n * 10) / 10; }

  epos.forEach(function (e) {
    var t = e.tempos;
    e.tempoCiclo = round1(t.chegada + t.armazenagem + t.distribuicao + t.retornoCampo + t.devolucao);
    e.tempoParada = e.tempoCiclo; // alias de compatibilidade
  });

  // -----------------------------------------------------------------------
  // KPIs - calculados a partir das EPOs para manter coerência.
  // -----------------------------------------------------------------------
  var somaParados = 0, somaCiclo = 0, somaConf = 0, somaNc = 0;
  var somaFontes = 0, somaControles = 0;
  var dist = { ouro: 0, prata: 0, bronze: 0, critico: 0 };
  epos.forEach(function (e) {
    somaParados += e.equipamentosParados;
    somaCiclo += e.tempoCiclo;
    somaConf += e.conformidade;
    somaNc += e.ncs;
    somaFontes += e.reversa.pctFontes;
    somaControles += e.reversa.pctControles;
    dist[e.tier] += 1;
  });

  var tempoMedioCiclo = round1(somaCiclo / epos.length);
  var kpis = {
    eposAuditadas: epos.length,
    equipParados: somaParados,
    tempoMedioCiclo: tempoMedioCiclo,
    tempoMedioParada: tempoMedioCiclo, // alias de compatibilidade
    conformidadeMedia: epos.length ? Math.round(somaConf / epos.length) : null,
    ncTotal: somaNc,
    distribuicao: dist,
    reversaQualidadeMedia: {
      pctFontes: epos.length ? Math.round(somaFontes / epos.length) : null,
      pctControles: epos.length ? Math.round(somaControles / epos.length) : null
    }
  };

  // -----------------------------------------------------------------------
  // Evidências (galeria) - registros fotográficos fictícios.
  // -----------------------------------------------------------------------
  // Achados de auditoria: vem das auditorias enviadas. Vazio de proposito.
  var evidencias = [];

  // -----------------------------------------------------------------------
  // Vistorias históricas por EPO (sintéticas, determinísticas).
  // Cada vistoria traz secoes por processo com drill-down por item.
  // -----------------------------------------------------------------------
  function seeded(n) {
    var x = Math.sin(n * 999.17) * 43758.5453;
    return x - Math.floor(x); // 0..1 determinístico
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function tierDe(score) {
    if (score >= tierRules.ouroMin) return "ouro";
    if (score >= tierRules.prataMin) return "prata";
    if (score >= tierRules.bronzeMin) return "bronze";
    return "critico";
  }

  epos.forEach(function (e, ei) {
    var base = [
      { data: "2024-07-12", label: "jul/2024", off: 4 },
      { data: "2025-01-16", label: "jan/2025", off: 3 },
      { data: "2025-07-15", label: "jul/2025", off: 2 },
      { data: "2026-01-18", label: "jan/2026", off: 1 },
      { data: "2026-07-18", label: "jul/2026", off: 0 }
    ];
    e.vistorias = base.map(function (vb, vi) {
      var score = Math.round(clamp(e.score - vb.off * 8, 34, 98));
      var fator = 1 + vb.off * 0.20; // vistorias antigas: tempos e NCs maiores
      var t = {
        chegada: round1(e.tempos.chegada * fator),
        armazenagem: round1(e.tempos.armazenagem * fator),
        distribuicao: round1(e.tempos.distribuicao * fator),
        retornoCampo: round1(e.tempos.retornoCampo * fator),
        devolucao: round1(e.tempos.devolucao * fator)
      };
      var ciclo = round1(t.chegada + t.armazenagem + t.distribuicao + t.retornoCampo + t.devolucao);
      var secoes = processos.map(function (p, si) {
        var r = seeded(ei * 137 + si * 19 + vi * 7);
        var pct = Math.round(clamp(score + (r * 34 - 17), 28, 100));
        var itens = p.itens.map(function (it, ii) {
          var ri = seeded(ei * 211 + si * 53 + vi * 13 + ii * 29);
          var ipct = Math.round(clamp(pct + (ri * 30 - 15), 20, 100));
          return { pergunta: it.pergunta, pct: ipct };
        });
        return { processoId: p.id, nome: p.nome, pct: pct, itens: itens };
      });
      return {
        data: vb.data,
        label: vb.label,
        score: score,
        tier: tierDe(score),
        conformidade: score,
        ncs: Math.round(e.ncs * fator),
        tempoCiclo: ciclo,
        tempos: t,
        secoes: secoes
      };
    });
  });

  // -----------------------------------------------------------------------
  // Páginas do sistema (espelham as telas existentes + acessos).
  // { key, label, icone, href } - key é a mesma usada em usuarios[].paginas.
  // -----------------------------------------------------------------------
  var paginas = [
    { key: "geral",       label: "Visão geral",              icone: "ti-layout-dashboard", href: "index.html" },
    { key: "epos",        label: "EPOs",                     icone: "ti-building-warehouse", href: "epos.html" },
    { key: "cronograma",  label: "Cronograma",               icone: "ti-calendar-stats",   href: "cronograma.html" },
    { key: "ranking",     label: "Ranking",                  icone: "ti-trophy",           href: "ranking.html" },
    { key: "comparativo", label: "Comparativo",              icone: "ti-arrows-diff",      href: "comparar.html" },
    { key: "gerencial",   label: "Painel gerencial",         icone: "ti-report-analytics", href: "gerencial.html" },
    { key: "pendentes",   label: "Auditorias pendentes",     icone: "ti-clipboard-list",   href: "pendentes.html" },
    { key: "auditoria",   label: "Preenchimento de questionário", icone: "ti-clipboard-check", href: "pendentes.html" },
    { key: "envio",       label: "Envio de evidências",      icone: "ti-cloud-upload",     href: "envio.html" },
    { key: "checagem",    label: "Evidências recebidas",     icone: "ti-zoom-check",       href: "checagem.html" },
    { key: "questionarios", label: "Questionários",          icone: "ti-list-details",     href: "questionarios.html" },
    { key: "alocacoes",   label: "Reenvio de checklist",     icone: "ti-user-plus",        href: "alocacoes.html" },
    { key: "giro",        label: "Contagem Logística Reversa", icone: "ti-packages",        href: "contagem-giro.html" },
    { key: "evidencias",  label: "Evidências",               icone: "ti-camera",           href: "evidencias.html" },
    { key: "criterios",   label: "Critérios da nota",        icone: "ti-adjustments",      href: "criterios-nota.html" },
    { key: "acessos",     label: "Gerenciamento de acessos", icone: "ti-lock-access",      href: "acessos.html" }
  ];

  // -----------------------------------------------------------------------
  // Presets de permissão por papel (usados como sugestão na tela de acessos).
  // -----------------------------------------------------------------------
  // "A princípio": responsável só envia evidências; auditor APSIS só vê os questionários.
  // Tres visoes, nao cinco. Quem coordena (admin e gestor da APSIS, gerente da
  // Claro) ve o sistema inteiro e da no mesmo lugar; o consultor em campo ve o
  // que preenche; o responsavel da EPO ve o que envia.
  // O recorte dos DADOS continua sendo por papel no banco: o gerente da Claro
  // enxerga apenas as EPOs do cliente dele, e isso nao depende desta tabela.
  // Coordenação APSIS e gerência da Claro veem o sistema inteiro.
  var visaoCoordenacao = {
    epos: true,  geral: true,  ranking: true,  comparativo: true,  gerencial: true,
    pendentes: true,  auditoria: true,  envio: true,  checagem: true,  alocacoes: true,
    giro: true,  evidencias: true,  criterios: true,  acessos: true,  questionarios: true,
    cronograma: true
  };

  // O consultor de campo enxerga o cronograma porque e a agenda das visitas
  // dele, mas so de leitura: quem marca data e a coordenacao.
  var papeisPreset = {
    admin:       visaoCoordenacao,
    gestor:      visaoCoordenacao,
    cliente:     visaoCoordenacao,
    auditor:     { epos: false, geral: false, ranking: false, comparativo: false, gerencial: false, pendentes: true,  auditoria: true,  envio: false, checagem: false, alocacoes: false, giro: true,  evidencias: false, criterios: false, acessos: false, questionarios: false, cronograma: true },
    responsavel: { epos: false, geral: false, ranking: false, comparativo: false, gerencial: false, pendentes: false, auditoria: false, envio: true,  checagem: false, alocacoes: false, giro: true,  evidencias: false, criterios: false, acessos: false, questionarios: false, cronograma: false },
    // Entrou no sistema, mas a APSIS ainda nao liberou o acesso. Nao alcanca
    // tela nenhuma: quem cai aqui vai para a pagina que explica isso.
    sem_acesso: { epos: false, geral: false, ranking: false, comparativo: false, gerencial: false, pendentes: false, auditoria: false, envio: false, checagem: false, alocacoes: false, giro: false, evidencias: false, criterios: false, acessos: false, questionarios: false, cronograma: false }
  };

  function copiaPreset(papel) {
    var base = papeisPreset[papel] || {};
    var out = {};
    paginas.forEach(function (p) { out[p.key] = !!base[p.key]; });
    return out;
  }

  // -----------------------------------------------------------------------
  // Usuários fictícios (LGPD: nomes e e-mails 100% inventados).
  // paginas: { geral, ranking, comparativo, gerencial, auditoria, evidencias, config, acessos }
  // -----------------------------------------------------------------------
  // Pessoas: vem do cadastro de perfis e da lista de acessos liberados. A
  // tela de acessos le as duas coisas do sistema, nao daqui.
  var usuarios = [];

  // -----------------------------------------------------------------------
  // Anexos recebidos via link seguro (o responsável da EPO envia NFs e
  // evidências pelo link temporário; aparecem aqui para triagem/vínculo).
  // status: "novo" (aguardando triagem) | "vinculado" (já ligado à auditoria)
  // -----------------------------------------------------------------------
  // Arquivos recebidos: vem dos anexos dos relatorios pedidos. Vazio de
  // proposito.
  var anexosRecebidos = [];

  // -----------------------------------------------------------------------
  // Exposição global
  // -----------------------------------------------------------------------
  window.APP = {
    cliente: cliente,
    clientes: clientes,
    tierRules: tierRules,
    processos: processos,
    checklist: processos, // ALIAS de compatibilidade (mesma referência)
    checklistCarregadores: checklistCarregadores,
    kpis: kpis,
    epos: epos,
    evidencias: evidencias,
    paginas: paginas,
    papeisPreset: papeisPreset,
    usuarios: usuarios,
    anexosRecebidos: anexosRecebidos
  };
})();
