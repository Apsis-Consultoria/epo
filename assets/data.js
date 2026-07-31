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
  var epos = [
    {
      id: "meridiano",
      nome: "EPO Meridiano",
      cidade: "São Paulo",
      uf: "SP",
      tier: "ouro",
      score: 92,
      equipamentos: 420,
      equipamentosParados: 8,
      tempos: { chegada: 1.2, armazenagem: 1.5, distribuicao: 1.4, retornoCampo: 1.8, devolucao: 1.6 },
      conformidade: 94,
      ncs: 2,
      reversa: {
        aderenciaCalendario: 97,
        volumeDevolvido: 1180,
        saldoSistema: 1235,
        pctFontes: 88,
        pctControles: 84,
        metaFontes: 75,
        metaControles: 75,
        altoGiro: { equipamentos: 1180, fontes: 1038, controles: 991 }
      },
      historico: [
        { mes: "Fev", score: 86 },
        { mes: "Mar", score: 88 },
        { mes: "Abr", score: 89 },
        { mes: "Mai", score: 90 },
        { mes: "Jun", score: 91 },
        { mes: "Jul", score: 92 }
      ],
      naoConformidades: [
        {
          item: "Volumes identificados com conteúdo completo",
          processo: "Devolução - Logística Reversa",
          gravidade: "baixa",
          evidencia: true,
          legenda: "Dois volumes com etiqueta de conteúdo incompleta no lote de julho.",
          data: "2026-07-09"
        },
        {
          item: "Empilhamento, segregação e identificação corretos",
          processo: "Armazenagem & Facilities",
          gravidade: "baixa",
          evidencia: true,
          legenda: "Lote com etiquetas desbotadas na prateleira B3.",
          data: "2026-07-09"
        }
      ]
    },
    {
      id: "farol",
      nome: "EPO Farol",
      cidade: "Recife",
      uf: "PE",
      tier: "ouro",
      score: 90,
      equipamentos: 380,
      equipamentosParados: 10,
      tempos: { chegada: 1.4, armazenagem: 1.7, distribuicao: 1.5, retornoCampo: 2.0, devolucao: 1.8 },
      conformidade: 92,
      ncs: 3,
      reversa: {
        aderenciaCalendario: 94,
        volumeDevolvido: 1050,
        saldoSistema: 1120,
        pctFontes: 84,
        pctControles: 81,
        metaFontes: 75,
        metaControles: 75,
        altoGiro: { equipamentos: 1050, fontes: 882, controles: 851 }
      },
      historico: [
        { mes: "Fev", score: 84 },
        { mes: "Mar", score: 85 },
        { mes: "Abr", score: 87 },
        { mes: "Mai", score: 88 },
        { mes: "Jun", score: 89 },
        { mes: "Jul", score: 90 }
      ],
      naoConformidades: [
        {
          item: "Cumprimento da calendarização (devolução no dia agendado)",
          processo: "Devolução - Logística Reversa",
          gravidade: "media",
          evidencia: true,
          legenda: "Um lote devolvido com 2 dias de atraso em relação à agenda.",
          data: "2026-07-11"
        },
        {
          item: "OS executada = OS baixada (sem backlog)",
          processo: "Baixas (BTP/SAP)",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Três OS executadas aguardando baixa há mais de 24h.",
          data: "2026-07-11"
        },
        {
          item: "Equipamentos em plástico-bolha individual",
          processo: "Devolução - Logística Reversa",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Amostra com equipamentos sem plástico-bolha em um volume.",
          data: "2026-07-11"
        }
      ]
    },
    {
      id: "vertice",
      nome: "EPO Vértice",
      cidade: "Curitiba",
      uf: "PR",
      tier: "ouro",
      score: 88,
      equipamentos: 350,
      equipamentosParados: 12,
      tempos: { chegada: 1.5, armazenagem: 1.8, distribuicao: 1.6, retornoCampo: 2.1, devolucao: 2.0 },
      conformidade: 90,
      ncs: 3,
      reversa: {
        aderenciaCalendario: 92,
        volumeDevolvido: 960,
        saldoSistema: 1040,
        pctFontes: 80,
        pctControles: 78,
        metaFontes: 75,
        metaControles: 75,
        altoGiro: { equipamentos: 960, fontes: 768, controles: 749 }
      },
      historico: [
        { mes: "Fev", score: 83 },
        { mes: "Mar", score: 84 },
        { mes: "Abr", score: 85 },
        { mes: "Mai", score: 86 },
        { mes: "Jun", score: 87 },
        { mes: "Jul", score: 88 }
      ],
      naoConformidades: [
        {
          item: "Inventário rotativo executado e conciliado com o sistema",
          processo: "Armazenagem & Facilities",
          gravidade: "media",
          evidencia: true,
          legenda: "Divergência de inventário - cadastro indicava 40, havia 34.",
          data: "2026-07-14"
        },
        {
          item: "Registro sistêmico do recebimento no mesmo dia (D+0)",
          processo: "Recebimento",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Dois recebimentos lançados apenas em D+1.",
          data: "2026-07-14"
        },
        {
          item: "Volumes identificados com conteúdo completo",
          processo: "Devolução - Logística Reversa",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Etiquetas ausentes em volumes recém-montados.",
          data: "2026-07-14"
        }
      ]
    },
    {
      id: "aurora",
      nome: "EPO Aurora",
      cidade: "Belo Horizonte",
      uf: "MG",
      tier: "prata",
      score: 83,
      equipamentos: 290,
      equipamentosParados: 18,
      tempos: { chegada: 1.8, armazenagem: 2.2, distribuicao: 1.9, retornoCampo: 2.4, devolucao: 2.6 },
      conformidade: 85,
      ncs: 5,
      reversa: {
        aderenciaCalendario: 85,
        volumeDevolvido: 820,
        saldoSistema: 930,
        pctFontes: 74,
        pctControles: 71,
        metaFontes: 75,
        metaControles: 75,
        altoGiro: { equipamentos: 820, fontes: 607, controles: 582 }
      },
      historico: [
        { mes: "Fev", score: 80 },
        { mes: "Mar", score: 81 },
        { mes: "Abr", score: 82 },
        { mes: "Mai", score: 82 },
        { mes: "Jun", score: 83 },
        { mes: "Jul", score: 83 }
      ],
      naoConformidades: [
        {
          item: "Qualidade da reversa: fontes devolvidas ≥ meta de 75%",
          processo: "Devolução - Logística Reversa",
          gravidade: "media",
          evidencia: true,
          legenda: "Fontes devolvidas em 74% - logo abaixo da meta de 75%.",
          data: "2026-07-16"
        },
        {
          item: "Inventário rotativo executado e conciliado com o sistema",
          processo: "Armazenagem & Facilities",
          gravidade: "media",
          evidencia: true,
          legenda: "Divergência de inventário - eram pra ter 60, havia 48.",
          data: "2026-07-16"
        },
        {
          item: "Cumprimento da calendarização (devolução no dia agendado)",
          processo: "Devolução - Logística Reversa",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Dois lotes devolvidos fora do dia agendado no mês.",
          data: "2026-07-16"
        },
        {
          item: "Baixas diárias via BTP",
          processo: "Baixas (BTP/SAP)",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Baixas acumuladas para a sexta-feira em duas semanas.",
          data: "2026-07-16"
        },
        {
          item: "Separação por modelo/família",
          processo: "Devolução - Logística Reversa",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Modelos misturados em parte dos volumes conferidos.",
          data: "2026-07-16"
        }
      ]
    },
    {
      id: "nexus",
      nome: "EPO Nexus",
      cidade: "Porto Alegre",
      uf: "RS",
      tier: "prata",
      score: 79,
      equipamentos: 260,
      equipamentosParados: 22,
      tempos: { chegada: 2.1, armazenagem: 2.5, distribuicao: 2.1, retornoCampo: 2.6, devolucao: 3.0 },
      conformidade: 81,
      ncs: 6,
      reversa: {
        aderenciaCalendario: 78,
        volumeDevolvido: 700,
        saldoSistema: 845,
        pctFontes: 66,
        pctControles: 62,
        metaFontes: 75,
        metaControles: 75,
        altoGiro: { equipamentos: 700, fontes: 462, controles: 434 }
      },
      historico: [
        { mes: "Fev", score: 82 },
        { mes: "Mar", score: 81 },
        { mes: "Abr", score: 80 },
        { mes: "Mai", score: 80 },
        { mes: "Jun", score: 79 },
        { mes: "Jul", score: 79 }
      ],
      naoConformidades: [
        {
          item: "Conferência 100% dos seriais (ZTC) + RNC quando divergente",
          processo: "Devolução - Logística Reversa",
          gravidade: "alta",
          evidencia: true,
          legenda: "Saldo no sistema de 845 x 700 devolvidos - diferença sem justificativa.",
          data: "2026-07-18"
        },
        {
          item: "Qualidade da reversa: fontes devolvidas ≥ meta de 75%",
          processo: "Devolução - Logística Reversa",
          gravidade: "media",
          evidencia: true,
          legenda: "Fontes devolvidas em 66% contra meta de 75%.",
          data: "2026-07-18"
        },
        {
          item: "OS executada = OS baixada (sem backlog)",
          processo: "Baixas (BTP/SAP)",
          gravidade: "media",
          evidencia: false,
          legenda: "Backlog de baixas superior a 3 dias em parte das OS.",
          data: "2026-07-18"
        },
        {
          item: "Registro sistêmico do recebimento no mesmo dia (D+0)",
          processo: "Recebimento",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Registros de entrada sem assinatura do responsável.",
          data: "2026-07-18"
        },
        {
          item: "Volumes lacrados",
          processo: "Devolução - Logística Reversa",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Volumes sem lacre aguardando coleta na doca.",
          data: "2026-07-18"
        },
        {
          item: "Empilhamento, segregação e identificação corretos",
          processo: "Armazenagem & Facilities",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Equipamentos sem etiqueta na área de triagem.",
          data: "2026-07-18"
        }
      ]
    },
    {
      id: "orbita",
      nome: "EPO Órbita",
      cidade: "Salvador",
      uf: "BA",
      tier: "prata",
      score: 74,
      equipamentos: 230,
      equipamentosParados: 28,
      tempos: { chegada: 2.4, armazenagem: 2.8, distribuicao: 2.3, retornoCampo: 2.9, devolucao: 3.6 },
      conformidade: 77,
      ncs: 8,
      reversa: {
        aderenciaCalendario: 72,
        volumeDevolvido: 610,
        saldoSistema: 790,
        pctFontes: 58,
        pctControles: 54,
        metaFontes: 75,
        metaControles: 75,
        altoGiro: { equipamentos: 610, fontes: 354, controles: 329 }
      },
      historico: [
        { mes: "Fev", score: 78 },
        { mes: "Mar", score: 77 },
        { mes: "Abr", score: 76 },
        { mes: "Mai", score: 75 },
        { mes: "Jun", score: 75 },
        { mes: "Jul", score: 74 }
      ],
      naoConformidades: [
        {
          item: "Cumprimento da calendarização (devolução no dia agendado)",
          processo: "Devolução - Logística Reversa",
          gravidade: "alta",
          evidencia: true,
          legenda: "Metade dos lotes do mês devolvida fora do dia agendado.",
          data: "2026-07-20"
        },
        {
          item: "Qualidade da reversa: fontes devolvidas ≥ meta de 75%",
          processo: "Devolução - Logística Reversa",
          gravidade: "alta",
          evidencia: true,
          legenda: "Fontes devolvidas em 58% - muito abaixo da meta de 75%.",
          data: "2026-07-20"
        },
        {
          item: "Integração BTP -> SAP sem pendências",
          processo: "Baixas (BTP/SAP)",
          gravidade: "media",
          evidencia: false,
          legenda: "Pendências de integração acumuladas na MB51.",
          data: "2026-07-20"
        },
        {
          item: "Caixa padrão ou Ecobox",
          processo: "Devolução - Logística Reversa",
          gravidade: "media",
          evidencia: true,
          legenda: "Uso de caixas fora do padrão em parte dos volumes.",
          data: "2026-07-20"
        },
        {
          item: "Login individual - sem compartilhamento de senha",
          processo: "Treinamento & Pessoas",
          gravidade: "media",
          evidencia: false,
          legenda: "Dois operadores utilizando o mesmo login no Atlas.",
          data: "2026-07-20"
        },
        {
          item: "Área de defeito/reversa segregada e sinalizada",
          processo: "Armazenagem & Facilities",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Sinalização da área de reversa apagada.",
          data: "2026-07-20"
        }
      ]
    },
    {
      id: "litoral",
      nome: "EPO Litoral",
      cidade: "Fortaleza",
      uf: "CE",
      tier: "bronze",
      score: 66,
      equipamentos: 180,
      equipamentosParados: 35,
      tempos: { chegada: 2.9, armazenagem: 3.4, distribuicao: 2.7, retornoCampo: 3.3, devolucao: 4.5 },
      conformidade: 69,
      ncs: 11,
      reversa: {
        aderenciaCalendario: 64,
        volumeDevolvido: 480,
        saldoSistema: 700,
        pctFontes: 47,
        pctControles: 44,
        metaFontes: 75,
        metaControles: 75,
        altoGiro: { equipamentos: 480, fontes: 226, controles: 211 }
      },
      historico: [
        { mes: "Fev", score: 72 },
        { mes: "Mar", score: 70 },
        { mes: "Abr", score: 69 },
        { mes: "Mai", score: 68 },
        { mes: "Jun", score: 67 },
        { mes: "Jul", score: 66 }
      ],
      naoConformidades: [
        {
          item: "Qualidade da reversa: fontes devolvidas ≥ meta de 75%",
          processo: "Devolução - Logística Reversa",
          gravidade: "alta",
          evidencia: true,
          legenda: "Fontes devolvidas em 47% contra meta de 75%.",
          data: "2026-07-21"
        },
        {
          item: "Cumprimento da calendarização (devolução no dia agendado)",
          processo: "Devolução - Logística Reversa",
          gravidade: "alta",
          evidencia: true,
          legenda: "Devoluções sem aderência à agenda - lotes represados na doca.",
          data: "2026-07-21"
        },
        {
          item: "OS executada = OS baixada (sem backlog)",
          processo: "Baixas (BTP/SAP)",
          gravidade: "alta",
          evidencia: false,
          legenda: "Grande backlog de OS executadas sem baixa no sistema.",
          data: "2026-07-21"
        },
        {
          item: "Equipamentos em plástico-bolha individual",
          processo: "Devolução - Logística Reversa",
          gravidade: "media",
          evidencia: true,
          legenda: "Equipamentos soltos na caixa, sem proteção individual.",
          data: "2026-07-21"
        },
        {
          item: "Empilhamento, segregação e identificação corretos",
          processo: "Armazenagem & Facilities",
          gravidade: "media",
          evidencia: true,
          legenda: "Equipamentos sem identificação empilhados no corredor.",
          data: "2026-07-21"
        },
        {
          item: "Certificados \"Aprenda Mais\" de quem executa o processo",
          processo: "Treinamento & Pessoas",
          gravidade: "media",
          evidencia: false,
          legenda: "Parte da equipe sem certificado Aprenda Mais válido.",
          data: "2026-07-21"
        }
      ]
    },
    {
      id: "delta",
      nome: "EPO Delta",
      cidade: "Manaus",
      uf: "AM",
      tier: "critico",
      score: 48,
      equipamentos: 150,
      equipamentosParados: 42,
      tempos: { chegada: 3.6, armazenagem: 4.3, distribuicao: 3.2, retornoCampo: 4.0, devolucao: 6.2 },
      conformidade: 52,
      ncs: 14,
      reversa: {
        aderenciaCalendario: 56,
        volumeDevolvido: 310,
        saldoSistema: 620,
        pctFontes: 38,
        pctControles: 33,
        metaFontes: 75,
        metaControles: 75,
        altoGiro: { equipamentos: 310, fontes: 118, controles: 102 }
      },
      historico: [
        { mes: "Fev", score: 60 },
        { mes: "Mar", score: 57 },
        { mes: "Abr", score: 54 },
        { mes: "Mai", score: 52 },
        { mes: "Jun", score: 50 },
        { mes: "Jul", score: 48 }
      ],
      naoConformidades: [
        {
          item: "Cumprimento da calendarização (devolução no dia agendado)",
          processo: "Devolução - Logística Reversa",
          gravidade: "alta",
          evidencia: true,
          legenda: "Sem calendário de devolução - lotes despachados sem agendamento.",
          data: "2026-07-22"
        },
        {
          item: "Qualidade da reversa: fontes devolvidas ≥ meta de 75%",
          processo: "Devolução - Logística Reversa",
          gravidade: "alta",
          evidencia: true,
          legenda: "Fontes devolvidas em 38% - menos da metade da meta de 75%.",
          data: "2026-07-22"
        },
        {
          item: "Login individual - sem compartilhamento de senha",
          processo: "Treinamento & Pessoas",
          gravidade: "alta",
          evidencia: true,
          legenda: "Login compartilhado por toda a equipe no Atlas - não conformidade grave.",
          data: "2026-07-22"
        },
        {
          item: "Equipamentos retirados do cliente sem baixa sinalizados à Claro",
          processo: "Presos em Assinante",
          gravidade: "alta",
          evidencia: false,
          legenda: "Equipamentos retirados do assinante sem qualquer baixa no sistema.",
          data: "2026-07-22"
        },
        {
          item: "Caixa padrão ou Ecobox",
          processo: "Devolução - Logística Reversa",
          gravidade: "media",
          evidencia: true,
          legenda: "Devolução em caixas improvisadas, sem lacre nem identificação.",
          data: "2026-07-22"
        },
        {
          item: "Books/POPs/manuais atualizados",
          processo: "Documentação & Sistemas",
          gravidade: "media",
          evidencia: false,
          legenda: "Controle feito apenas em papel avulso, sem POP atualizado.",
          data: "2026-07-22"
        }
      ]
    },
    {
      // Unidade de teste no Centro-Oeste, para a regiao aparecer no mapa.
      id: "cerrado",
      nome: "EPO Cerrado (teste)",
      cidade: "Goiânia",
      uf: "GO",
      endereco: "Avenida Anhanguera, 5000",
      cep: "74110-010",
      tier: "bronze",
      score: 68,
      equipamentos: 265,
      equipamentosParados: 21,
      tempos: { chegada: 2.1, armazenagem: 2.6, distribuicao: 2.2, retornoCampo: 3.1, devolucao: 2.8 },
      conformidade: 71,
      ncs: 6,
      reversa: {
        aderenciaCalendario: 78,
        volumeDevolvido: 610,
        saldoSistema: 742,
        pctFontes: 69,
        pctControles: 64,
        metaFontes: 75,
        metaControles: 75,
        altoGiro: { equipamentos: 610, fontes: 421, controles: 390 }
      },
      historico: [
        { mes: "Fev", score: 58 },
        { mes: "Mar", score: 60 },
        { mes: "Abr", score: 63 },
        { mes: "Mai", score: 64 },
        { mes: "Jun", score: 66 },
        { mes: "Jul", score: 68 }
      ],
      naoConformidades: [
        {
          item: "Área de defeitos/reversa segregada e sinalizada",
          processo: "Armazenagem & Facilities",
          gravidade: "media",
          evidencia: true,
          legenda: "Área de reversa sem sinalização e dividindo espaço com material bom para uso.",
          data: "2026-07-16"
        },
        {
          item: "Baixas diárias via BTP",
          processo: "Baixas - BTP / SAP / TOA",
          gravidade: "alta",
          evidencia: false,
          legenda: "Baixas acumuladas de três dias lançadas de uma vez.",
          data: "2026-07-16"
        }
      ]
    }
  ];

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
    conformidadeMedia: Math.round(somaConf / epos.length),
    ncTotal: somaNc,
    distribuicao: dist,
    reversaQualidadeMedia: {
      pctFontes: Math.round(somaFontes / epos.length),
      pctControles: Math.round(somaControles / epos.length)
    }
  };

  // -----------------------------------------------------------------------
  // Evidências (galeria) - registros fotográficos fictícios.
  // -----------------------------------------------------------------------
  var evidencias = [
    {
      id: "ev-01",
      foto: "assets/evidencias/ev-01.jpeg",
      epoId: "nexus",
      epoNome: "EPO Nexus",
      item: "Conferência 100% dos seriais (ZTC) + RNC quando divergente",
      processo: "Devolução - Logística Reversa",
      legenda: "Saldo no sistema de 845 x 700 devolvidos - diferença sem justificativa.",
      gravidade: "alta",
      data: "2026-07-18"
    },
    {
      id: "ev-02",
      foto: "assets/evidencias/ev-02.jpeg",
      epoId: "litoral",
      epoNome: "EPO Litoral",
      item: "Cumprimento da calendarização (devolução no dia agendado)",
      processo: "Devolução - Logística Reversa",
      legenda: "Lotes de devolução represados na doca, fora da agenda.",
      gravidade: "alta",
      data: "2026-07-21"
    },
    {
      id: "ev-03",
      foto: "assets/evidencias/ev-03.jpeg",
      epoId: "delta",
      epoNome: "EPO Delta",
      item: "Caixa padrão ou Ecobox",
      processo: "Devolução - Logística Reversa",
      legenda: "Devolução em caixas improvisadas, sem lacre nem identificação.",
      gravidade: "alta",
      data: "2026-07-22"
    },
    {
      id: "ev-04",
      foto: "assets/evidencias/ev-04.jpg",
      epoId: "orbita",
      epoNome: "EPO Órbita",
      item: "Qualidade da reversa: fontes devolvidas ≥ meta de 75%",
      processo: "Devolução - Logística Reversa",
      legenda: "Fontes devolvidas em 58% - muito abaixo da meta de 75%.",
      gravidade: "alta",
      data: "2026-07-20"
    },
    {
      id: "ev-05",
      foto: "assets/evidencias/ev-05.jpeg",
      epoId: "aurora",
      epoNome: "EPO Aurora",
      item: "Inventário rotativo executado e conciliado com o sistema",
      processo: "Armazenagem & Facilities",
      legenda: "Divergência de inventário - eram pra ter 60, havia 48.",
      gravidade: "media",
      data: "2026-07-16"
    },
    {
      id: "ev-06",
      foto: "assets/evidencias/ev-06.jpeg",
      epoId: "farol",
      epoNome: "EPO Farol",
      item: "Cumprimento da calendarização (devolução no dia agendado)",
      processo: "Devolução - Logística Reversa",
      legenda: "Um lote devolvido com 2 dias de atraso em relação à agenda.",
      gravidade: "media",
      data: "2026-07-11"
    },
    {
      id: "ev-07",
      foto: "assets/evidencias/ev-01.jpeg",
      epoId: "vertice",
      epoNome: "EPO Vértice",
      item: "Inventário rotativo executado e conciliado com o sistema",
      processo: "Armazenagem & Facilities",
      legenda: "Divergência de inventário - cadastro indicava 40, havia 34.",
      gravidade: "media",
      data: "2026-07-14"
    },
    {
      id: "ev-08",
      foto: "assets/evidencias/ev-02.jpeg",
      epoId: "litoral",
      epoNome: "EPO Litoral",
      item: "Empilhamento, segregação e identificação corretos",
      processo: "Armazenagem & Facilities",
      legenda: "Equipamentos sem identificação empilhados no corredor.",
      gravidade: "media",
      data: "2026-07-21"
    },
    {
      id: "ev-09",
      foto: "assets/evidencias/ev-03.jpeg",
      epoId: "meridiano",
      epoNome: "EPO Meridiano",
      item: "Empilhamento, segregação e identificação corretos",
      processo: "Armazenagem & Facilities",
      legenda: "Lote com etiquetas desbotadas na prateleira B3.",
      gravidade: "baixa",
      data: "2026-07-09"
    }
  ];

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
    { key: "ranking",     label: "Ranking",                  icone: "ti-trophy",           href: "ranking.html" },
    { key: "comparativo", label: "Comparativo",              icone: "ti-arrows-diff",      href: "comparar.html" },
    { key: "gerencial",   label: "Painel gerencial",         icone: "ti-report-analytics", href: "gerencial.html" },
    { key: "pendentes",   label: "Auditorias pendentes",     icone: "ti-clipboard-list",   href: "pendentes.html" },
    { key: "auditoria",   label: "Preenchimento de questionário", icone: "ti-clipboard-check", href: "pendentes.html" },
    { key: "envio",       label: "Envio de comprovações",    icone: "ti-cloud-upload",     href: "envio.html" },
    { key: "checagem",    label: "Comprovações",             icone: "ti-zoom-check",       href: "checagem.html" },
    { key: "alocacoes",   label: "Alocações",                icone: "ti-user-plus",        href: "alocacoes.html" },
    { key: "giro",        label: "Contagem Logística Reversa", icone: "ti-packages",        href: "contagem-giro.html" },
    { key: "evidencias",  label: "Evidências",               icone: "ti-camera",           href: "evidencias.html" },
    { key: "config",      label: "Configurações",            icone: "ti-settings",         href: "configuracoes.html" },
    { key: "acessos",     label: "Gerenciamento de acessos", icone: "ti-lock-access",      href: "acessos.html" }
  ];

  // -----------------------------------------------------------------------
  // Presets de permissão por papel (usados como sugestão na tela de acessos).
  // -----------------------------------------------------------------------
  // "A princípio": responsável só envia comprovações; auditor APSIS só vê os questionários.
  // Tres visoes, nao cinco. Quem coordena (admin e gestor da APSIS, gerente da
  // Claro) ve o sistema inteiro e da no mesmo lugar; o consultor em campo ve o
  // que preenche; o responsavel da EPO ve o que envia.
  // O recorte dos DADOS continua sendo por papel no banco: o gerente da Claro
  // enxerga apenas as EPOs do cliente dele, e isso nao depende desta tabela.
  // Coordenação APSIS e gerência da Claro veem o sistema inteiro.
  var visaoCoordenacao = {
    epos: true,  geral: true,  ranking: true,  comparativo: true,  gerencial: true,
    pendentes: true,  auditoria: true,  envio: true,  checagem: true,  alocacoes: true,
    giro: true,  evidencias: true,  config: true,  acessos: true
  };

  var papeisPreset = {
    admin:       visaoCoordenacao,
    gestor:      visaoCoordenacao,
    cliente:     visaoCoordenacao,
    auditor:     { epos: false, geral: false, ranking: false, comparativo: false, gerencial: false, pendentes: true,  auditoria: true,  envio: false, checagem: false, alocacoes: false, giro: true,  evidencias: false, config: false, acessos: false },
    responsavel: { epos: false, geral: false, ranking: false, comparativo: false, gerencial: false, pendentes: false, auditoria: false, envio: true,  checagem: false, alocacoes: false, giro: true,  evidencias: false, config: false, acessos: false }
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
  var usuarios = [
    {
      id: "u-01",
      nome: "Ana Ribeiro",
      email: "ana.ribeiro@apsis.com.br",
      papel: "auditor",
      ativo: true,
      paginas: copiaPreset("auditor")
    },
    {
      id: "u-02",
      nome: "Leonardo Carvalho",
      email: "leonardo.carvalho@apsis.com.br",
      papel: "admin",
      ativo: true,
      paginas: copiaPreset("admin")
    },
    {
      id: "u-03",
      nome: "Sergio Freitas",
      email: "sergio.freitas@apsis.com.br",
      papel: "gestor",
      ativo: true,
      paginas: copiaPreset("gestor")
    },
    {
      id: "u-04",
      nome: "Leandro Souza",
      email: "leandro.souza@apsis.com.br",
      papel: "auditor",
      ativo: true,
      paginas: copiaPreset("auditor")
    },
    {
      id: "u-05",
      nome: "Jeferson Teixeira",
      email: "jeferson.teixeira@claro.com.br",
      papel: "cliente",
      ativo: true,
      paginas: copiaPreset("cliente")
    },
    {
      id: "u-06",
      nome: "Fabio Morales",
      email: "fabio.morales@claro.com.br",
      papel: "cliente",
      ativo: true,
      paginas: copiaPreset("cliente")
    }
  ];

  // -----------------------------------------------------------------------
  // Anexos recebidos via link seguro (o responsável da EPO envia NFs e
  // evidências pelo link temporário; aparecem aqui para triagem/vínculo).
  // status: "novo" (aguardando triagem) | "vinculado" (já ligado à auditoria)
  // -----------------------------------------------------------------------
  var anexosRecebidos = [
    {
      id: "ax-01",
      epoId: "meridiano",
      epoNome: "EPO Meridiano",
      processo: "Recebimento",
      item: "Conferência física x NF (100%)",
      tipo: "NF-e",
      arquivo: "nfe-482910.pdf",
      remetente: "Responsável EPO Marcos Vidal",
      via: "link_seguro",
      data: "2026-07-27",
      status: "novo"
    },
    {
      id: "ax-02",
      epoId: "farol",
      epoNome: "EPO Farol",
      processo: "Baixas (BTP/SAP)",
      item: "Integração BTP -> SAP sem pendências",
      tipo: "Print Atlas",
      arquivo: "print-atlas-mb51.png",
      remetente: "Responsável EPO Carla Nunes",
      via: "link_seguro",
      data: "2026-07-26",
      status: "novo"
    },
    {
      id: "ax-03",
      epoId: "aurora",
      epoNome: "EPO Aurora",
      processo: "Devolução - Logística Reversa",
      item: "Cumprimento da calendarização",
      tipo: "E-mail",
      arquivo: "email-agenda-devolucao.eml",
      remetente: "Responsável EPO Paulo Siqueira",
      via: "link_seguro",
      data: "2026-07-24",
      status: "vinculado"
    },
    {
      id: "ax-04",
      epoId: "nexus",
      epoNome: "EPO Nexus",
      processo: "Recebimento",
      item: "Divergências a maior com NF complementar",
      tipo: "NF-e",
      arquivo: "nfe-complementar-77120.pdf",
      remetente: "Responsável EPO Renata Lopes",
      via: "link_seguro",
      data: "2026-07-23",
      status: "vinculado"
    },
    {
      id: "ax-05",
      epoId: "orbita",
      epoNome: "EPO Órbita",
      processo: "Treinamento & Pessoas",
      item: "Equipe treinada nos procedimentos",
      tipo: "Certificado",
      arquivo: "certificado-treinamento-epo.pdf",
      remetente: "Responsável EPO Diego Fontes",
      via: "link_seguro",
      data: "2026-07-21",
      status: "vinculado"
    },
    {
      id: "ax-06",
      epoId: "delta",
      epoNome: "EPO Delta",
      processo: "Armazenagem & Facilities",
      item: "CFTV/alarme ativos com registros",
      tipo: "Print Atlas",
      arquivo: "print-cftv-registros.png",
      remetente: "Responsável EPO Tatiane Prado",
      via: "link_seguro",
      data: "2026-07-19",
      status: "vinculado"
    }
  ];

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
