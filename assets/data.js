/* =========================================================================
   Auditoria de EPOs - dados mock (100% fictícios)
   window.APP - contrato consumido por todas as telas.
   ========================================================================= */
(function () {
  "use strict";

  // -----------------------------------------------------------------------
  // Regras de classificação por tier
  // -----------------------------------------------------------------------
  var tierRules = { ouroMin: 85, prataMin: 70, bronzeMin: 55 };

  // -----------------------------------------------------------------------
  // EPOs (8) - dados fictícios e plausíveis.
  // tempoParada ~ tempoChegada + tempoReparo + tempoRetorno
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
      tempoChegada: 1.5,
      tempoReparo: 3.2,
      tempoRetorno: 1.8,
      tempoParada: 6.5,
      conformidade: 94,
      ncs: 2,
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
          item: "Documentação de entrada e saída completa",
          bloco: "Documentação",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Duas ordens de serviço sem data de saída registrada.",
          data: "2026-07-09"
        },
        {
          item: "Equipamentos identificados e etiquetados",
          bloco: "Inventário",
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
      tempoChegada: 1.8,
      tempoReparo: 3.5,
      tempoRetorno: 2.0,
      tempoParada: 7.3,
      conformidade: 92,
      ncs: 3,
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
          item: "Reparo dentro do SLA contratual",
          bloco: "Processo de reparo",
          gravidade: "media",
          evidencia: true,
          legenda: "Três reparos excederam o SLA em até 1 dia útil.",
          data: "2026-07-11"
        },
        {
          item: "Ordem de serviço rastreável",
          bloco: "Processo de reparo",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Uma OS sem número de rastreio no sistema.",
          data: "2026-07-11"
        },
        {
          item: "Registro fotográfico das divergências",
          bloco: "Evidências e organização",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Registro fotográfico incompleto em um item.",
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
      tempoChegada: 2.0,
      tempoReparo: 3.6,
      tempoRetorno: 2.1,
      tempoParada: 7.7,
      conformidade: 90,
      ncs: 3,
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
          item: "Estoque físico compatível com o cadastro",
          bloco: "Inventário",
          gravidade: "media",
          evidencia: true,
          legenda: "Divergência de inventário - cadastro indicava 40, havia 34.",
          data: "2026-07-14"
        },
        {
          item: "Documentação de entrada e saída completa",
          bloco: "Documentação",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Planilha de entrada desatualizada em relação ao sistema.",
          data: "2026-07-14"
        },
        {
          item: "Equipamentos identificados e etiquetados",
          bloco: "Inventário",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Etiquetas ausentes em equipamentos recém-recebidos.",
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
      tempoChegada: 2.4,
      tempoReparo: 4.1,
      tempoRetorno: 2.5,
      tempoParada: 9.0,
      conformidade: 85,
      ncs: 5,
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
          item: "Reparo dentro do SLA contratual",
          bloco: "Processo de reparo",
          gravidade: "media",
          evidencia: true,
          legenda: "SLA de reparo ultrapassado em 20% das ordens amostradas.",
          data: "2026-07-16"
        },
        {
          item: "Estoque físico compatível com o cadastro",
          bloco: "Inventário",
          gravidade: "media",
          evidencia: true,
          legenda: "Divergência de inventário - eram pra ter 60, havia 48.",
          data: "2026-07-16"
        },
        {
          item: "Ordem de serviço rastreável",
          bloco: "Processo de reparo",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Duas OS sem vínculo com o equipamento no sistema.",
          data: "2026-07-16"
        },
        {
          item: "Documentação de entrada e saída completa",
          bloco: "Documentação",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Comprovantes de saída faltando em três registros.",
          data: "2026-07-16"
        },
        {
          item: "Equipamentos identificados e etiquetados",
          bloco: "Inventário",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Padrão de etiquetagem inconsistente entre prateleiras.",
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
      tempoChegada: 2.8,
      tempoReparo: 4.5,
      tempoRetorno: 2.7,
      tempoParada: 10.0,
      conformidade: 81,
      ncs: 6,
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
          item: "Estoque físico compatível com o cadastro",
          bloco: "Inventário",
          gravidade: "alta",
          evidencia: true,
          legenda: "Divergência de inventário - eram pra ter 10, havia 200.",
          data: "2026-07-18"
        },
        {
          item: "Reparo dentro do SLA contratual",
          bloco: "Processo de reparo",
          gravidade: "media",
          evidencia: true,
          legenda: "Tempo de reparo interno acima do previsto em contrato.",
          data: "2026-07-18"
        },
        {
          item: "Ordem de serviço rastreável",
          bloco: "Processo de reparo",
          gravidade: "media",
          evidencia: false,
          legenda: "Rastreio de OS interrompido na etapa de conclusão.",
          data: "2026-07-18"
        },
        {
          item: "Documentação de entrada e saída completa",
          bloco: "Documentação",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Registros de entrada sem assinatura do responsável.",
          data: "2026-07-18"
        },
        {
          item: "Registro fotográfico das divergências",
          bloco: "Evidências e organização",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Fotos sem data ou identificação do equipamento.",
          data: "2026-07-18"
        },
        {
          item: "Equipamentos identificados e etiquetados",
          bloco: "Inventário",
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
      tempoChegada: 3.1,
      tempoReparo: 5.0,
      tempoRetorno: 3.0,
      tempoParada: 11.1,
      conformidade: 77,
      ncs: 8,
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
          item: "Estoque físico compatível com o cadastro",
          bloco: "Inventário",
          gravidade: "alta",
          evidencia: true,
          legenda: "Divergência de inventário - cadastro indicava 15, havia 120.",
          data: "2026-07-20"
        },
        {
          item: "Reparo dentro do SLA contratual",
          bloco: "Processo de reparo",
          gravidade: "alta",
          evidencia: true,
          legenda: "SLA de reparo estourado em quase metade das ordens.",
          data: "2026-07-20"
        },
        {
          item: "Ordem de serviço rastreável",
          bloco: "Processo de reparo",
          gravidade: "media",
          evidencia: false,
          legenda: "Ordens de serviço sem histórico de etapas.",
          data: "2026-07-20"
        },
        {
          item: "Documentação de entrada e saída completa",
          bloco: "Documentação",
          gravidade: "media",
          evidencia: false,
          legenda: "Fluxo de documentação sem controle de versão.",
          data: "2026-07-20"
        },
        {
          item: "Equipamentos identificados e etiquetados",
          bloco: "Inventário",
          gravidade: "media",
          evidencia: true,
          legenda: "Equipamentos misturados sem separação por status.",
          data: "2026-07-20"
        },
        {
          item: "Registro fotográfico das divergências",
          bloco: "Evidências e organização",
          gravidade: "baixa",
          evidencia: false,
          legenda: "Evidências fotográficas arquivadas fora do padrão.",
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
      tempoChegada: 3.8,
      tempoReparo: 6.2,
      tempoRetorno: 3.6,
      tempoParada: 13.6,
      conformidade: 69,
      ncs: 11,
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
          item: "Estoque físico compatível com o cadastro",
          bloco: "Inventário",
          gravidade: "alta",
          evidencia: true,
          legenda: "Divergência de inventário - eram pra ter 10, havia 200.",
          data: "2026-07-21"
        },
        {
          item: "Reparo dentro do SLA contratual",
          bloco: "Processo de reparo",
          gravidade: "alta",
          evidencia: true,
          legenda: "Tempo de reparo interno mais que o dobro do SLA.",
          data: "2026-07-21"
        },
        {
          item: "Ordem de serviço rastreável",
          bloco: "Processo de reparo",
          gravidade: "alta",
          evidencia: false,
          legenda: "Grande parte das OS sem rastreabilidade no sistema.",
          data: "2026-07-21"
        },
        {
          item: "Documentação de entrada e saída completa",
          bloco: "Documentação",
          gravidade: "media",
          evidencia: false,
          legenda: "Documentação de saída ausente em vários equipamentos.",
          data: "2026-07-21"
        },
        {
          item: "Equipamentos identificados e etiquetados",
          bloco: "Inventário",
          gravidade: "media",
          evidencia: true,
          legenda: "Equipamentos sem identificação empilhados no corredor.",
          data: "2026-07-21"
        },
        {
          item: "Registro fotográfico das divergências",
          bloco: "Evidências e organização",
          gravidade: "media",
          evidencia: false,
          legenda: "Ausência de registro fotográfico nas divergências.",
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
      tempoChegada: 4.5,
      tempoReparo: 7.4,
      tempoRetorno: 4.2,
      tempoParada: 16.1,
      conformidade: 52,
      ncs: 14,
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
          item: "Estoque físico compatível com o cadastro",
          bloco: "Inventário",
          gravidade: "alta",
          evidencia: true,
          legenda: "Divergência de inventário - eram pra ter 10, havia 200.",
          data: "2026-07-22"
        },
        {
          item: "Reparo dentro do SLA contratual",
          bloco: "Processo de reparo",
          gravidade: "alta",
          evidencia: true,
          legenda: "Máquinas paradas há semanas sem previsão de reparo.",
          data: "2026-07-22"
        },
        {
          item: "Ordem de serviço rastreável",
          bloco: "Processo de reparo",
          gravidade: "alta",
          evidencia: false,
          legenda: "Sem sistema de rastreio de ordens de serviço.",
          data: "2026-07-22"
        },
        {
          item: "Documentação de entrada e saída completa",
          bloco: "Documentação",
          gravidade: "alta",
          evidencia: false,
          legenda: "Controle de entrada e saída feito apenas em papel avulso.",
          data: "2026-07-22"
        },
        {
          item: "Equipamentos identificados e etiquetados",
          bloco: "Inventário",
          gravidade: "media",
          evidencia: true,
          legenda: "Nenhum padrão de etiquetagem no galpão.",
          data: "2026-07-22"
        },
        {
          item: "Registro fotográfico das divergências",
          bloco: "Evidências e organização",
          gravidade: "media",
          evidencia: false,
          legenda: "Divergências sem qualquer registro fotográfico.",
          data: "2026-07-22"
        }
      ]
    }
  ];

  // -----------------------------------------------------------------------
  // KPIs - calculados a partir das EPOs para manter coerência.
  // -----------------------------------------------------------------------
  var somaParados = 0, somaParada = 0, somaConf = 0, somaNc = 0;
  var dist = { ouro: 0, prata: 0, bronze: 0, critico: 0 };
  epos.forEach(function (e) {
    somaParados += e.equipamentosParados;
    somaParada += e.tempoParada;
    somaConf += e.conformidade;
    somaNc += e.ncs;
    dist[e.tier] += 1;
  });

  var kpis = {
    eposAuditadas: epos.length,
    equipParados: somaParados,
    tempoMedioParada: Math.round((somaParada / epos.length) * 10) / 10, // ~10,2 d
    conformidadeMedia: Math.round(somaConf / epos.length), // ~81 %
    ncTotal: somaNc,
    distribuicao: dist
  };

  // -----------------------------------------------------------------------
  // Checklist - blocos com pesos que somam 100.
  // -----------------------------------------------------------------------
  // Fonte: "Checklist Gestão de Qualidade - EPO" (PDF, 4 páginas).
  // Cada item tem a "Evidência esperada" do documento original.
  // Pesos por seção somam 100 (proposta - ainda a validar com Claro/Sérgio).
  var checklist = [
    {
      bloco: "1. Recebimento & Expedição",
      peso: 20,
      itens: [
        { id: "rec-01", pergunta: "Conferência física x NF (100%) no recebimento do CD", evidencia: "NF-e, ZTC350/ZTC380, fotos", requerFoto: true },
        { id: "rec-02", pergunta: "Divergências a menor registradas com RNC e NF de diferença até D+2", evidencia: "Formulários, RNC, NF", requerFoto: false },
        { id: "rec-03", pergunta: "Divergências a maior tratadas com NF complementar até D+4", evidencia: "Formulários, NF complementar", requerFoto: false },
        { id: "rec-04", pergunta: "Expedição protegida (saco bolha), identificada e segregada de defeito/reversa", evidencia: "Fotos de staging", requerFoto: true },
        { id: "rec-05", pergunta: "Kitting completo por OS (terminais + acessórios)", evidencia: "Lista de conferência, fotos", requerFoto: true },
        { id: "rec-06", pergunta: "Triangulações aprovadas e registradas (SAP/Atlas)", evidencia: "NF triangulação, e-mails, SAP/Atlas", requerFoto: false },
        { id: "rec-07", pergunta: "Reinicializações/reusos via SharePoint com anexos padrão e comunicação ao DMT", evidencia: "SharePoint (Anexo I/II), e-mails", requerFoto: false },
        { id: "rec-08", pergunta: "Cobertura de estoque monitorada e ações para canal vermelho quando necessário", evidencia: "Relatórios de cobertura", requerFoto: false },
        { id: "rec-09", pergunta: "Separação física entre novo, reuso e defeito (áreas distintas/sinalizadas)", evidencia: "Layout/fotos", requerFoto: true },
        { id: "rec-10", pergunta: "Registro sistêmico de expedição/recebimento realizado no mesmo dia (D+0)", evidencia: "SAP/Atlas logs", requerFoto: false }
      ]
    },
    {
      bloco: "2. Armazenagem & Facilities",
      peso: 12,
      itens: [
        { id: "arm-01", pergunta: "Empilhamento/segregação/identificação corretos", evidencia: "Fotos/layout", requerFoto: true },
        { id: "arm-02", pergunta: "Área de defeitos/reversa segregada e sinalizada", evidencia: "Fotos", requerFoto: true },
        { id: "arm-03", pergunta: "CFTV/alarme ativos com registros disponíveis", evidencia: "Logs/prints", requerFoto: true },
        { id: "arm-04", pergunta: "Condições prediais (telhado/piso/iluminação/ergonomia) adequadas", evidencia: "Relatórios/fotos", requerFoto: true },
        { id: "arm-05", pergunta: "Proteção contra umidade/poeira/impacto (embalagens padrão)", evidencia: "Fotos", requerFoto: true },
        { id: "arm-06", pergunta: "Inventário rotativo executado e conciliado com sistema", evidencia: "Planilhas/relatórios", requerFoto: false },
        { id: "arm-07", pergunta: "Integridade das embalagens checada antes da expedição", evidencia: "Check de qualidade", requerFoto: false }
      ]
    },
    {
      bloco: "3. Baixas – BTP / SAP / TOA",
      peso: 13,
      itens: [
        { id: "bx-01", pergunta: "Baixas diárias via BTP", evidencia: "Logs BTP; MB51/MB1C; TOA", requerFoto: false },
        { id: "bx-02", pergunta: "Consumo TOA consistente com BOM", evidencia: "OS/WO; BOM", requerFoto: false },
        { id: "bx-03", pergunta: "Integração BTP→SAP sem pendências", evidencia: "MB51/MB1C", requerFoto: false },
        { id: "bx-04", pergunta: "Validação de ordens conforme consumo", evidencia: "TOA/OS/WO", requerFoto: false },
        { id: "bx-05", pergunta: "Controle de volumetria de reuso", evidencia: "Relatórios", requerFoto: false },
        { id: "bx-06", pergunta: "Análise baixado × serviço realizado", evidencia: "Amostragem comparativa", requerFoto: false }
      ]
    },
    {
      bloco: "4. Logística Reversa",
      peso: 15,
      itens: [
        { id: "lr-01", pergunta: "Lotes no Qualitor + estados validados no Atlas", evidencia: "Qualitor; Atlas", requerFoto: false },
        { id: "lr-02", pergunta: "NF-e espelho (J1B1N) emitida até 48h", evidencia: "J1B1N", requerFoto: false },
        { id: "lr-03", pergunta: "Packlist + NF 96h + validação BPO 24h", evidencia: "Qualitor", requerFoto: false },
        { id: "lr-04", pergunta: "Identificação correta e proteção individual", evidencia: "Manual; fotos", requerFoto: true },
        { id: "lr-05", pergunta: "Agendamento/entrega D+1", evidencia: "Agenda; canhotos", requerFoto: false },
        { id: "lr-06", pergunta: "Conferência 100% seriais (ZTC) + RNC", evidencia: "ZTC; RNC", requerFoto: false },
        { id: "lr-07", pergunta: "Acessórios via MB1C (Z61) + MB51", evidencia: "MB1C/MB51", requerFoto: false },
        { id: "lr-08", pergunta: "Devolução Bom p/ Uso – MB1C (Z42)", evidencia: "Autorização; MB1C", requerFoto: false }
      ]
    },
    {
      bloco: "5. Presos em Assinante",
      peso: 10,
      itens: [
        { id: "pa-01", pergunta: "Alerta quinzenal para aging > 30 dias", evidencia: "Atlas; e-mails", requerFoto: false },
        { id: "pa-02", pergunta: "Mudança para Análise de Inventário", evidencia: "Atlas/Portal IN", requerFoto: false },
        { id: "pa-03", pergunta: "Fluxo fotos 10% + Pipefy", evidencia: "Portal IN; Pipefy", requerFoto: true },
        { id: "pa-04", pergunta: "Reversa liberados + segregação presos", evidencia: "Atlas; Qualitor", requerFoto: false },
        { id: "pa-05", pergunta: "Revisita bimestral", evidencia: "Relatórios periódicos", requerFoto: false }
      ]
    },
    {
      bloco: "6. Documentação & Sistemas",
      peso: 10,
      itens: [
        { id: "doc-01", pergunta: "Books/POPs/manuais atualizados", evidencia: "Repositório", requerFoto: false },
        { id: "doc-02", pergunta: "Uso correto SAP/Atlas/SIAK/BTP/Qualitor", evidencia: "Prints/logs", requerFoto: true },
        { id: "doc-03", pergunta: "Evidências de reinicialização/triangulação", evidencia: "SharePoint; NFs", requerFoto: false },
        { id: "doc-04", pergunta: "Checklist técnico (triagem) completo", evidencia: "Registros de triagem", requerFoto: false }
      ]
    },
    {
      bloco: "7. Treinamento & Pessoas",
      peso: 8,
      itens: [
        { id: "tr-01", pergunta: "100% do time no Portal (KPI1)", evidencia: "Portal", requerFoto: false },
        { id: "tr-02", pergunta: "Meta de adesão (KPI2)", evidencia: "Relatórios", requerFoto: false },
        { id: "tr-03", pergunta: "Certificações válidas SAP/Atlas/BTP", evidencia: "Certificados", requerFoto: false },
        { id: "tr-04", pergunta: "Treinamentos sob demanda", evidencia: "Registros; RNC", requerFoto: false }
      ]
    },
    {
      bloco: "8. Governança & RNCs",
      peso: 12,
      itens: [
        { id: "gov-01", pergunta: "Desvios críticos reportados imediatamente", evidencia: "RNC; fotos/logs", requerFoto: true },
        { id: "gov-02", pergunta: "RNCs com prazos, responsáveis e eficácia", evidencia: "5W2H; RNC", requerFoto: false },
        { id: "gov-03", pergunta: "Reunião mensal + ranking", evidencia: "Ata", requerFoto: false },
        { id: "gov-04", pergunta: "Plano de melhorias atualizado", evidencia: "Plano; 5W2H", requerFoto: false }
      ]
    }
  ];

  // -----------------------------------------------------------------------
  // Evidências (galeria) - ~9 registros fotográficos fictícios.
  // -----------------------------------------------------------------------
  var evidencias = [
    {
      id: "ev-01",
      epoId: "nexus",
      epoNome: "EPO Nexus",
      item: "Estoque físico compatível com o cadastro",
      bloco: "Inventário",
      legenda: "Divergência de inventário - eram pra ter 10, havia 200.",
      gravidade: "alta",
      data: "2026-07-18"
    },
    {
      id: "ev-02",
      epoId: "litoral",
      epoNome: "EPO Litoral",
      item: "Estoque físico compatível com o cadastro",
      bloco: "Inventário",
      legenda: "Divergência de inventário - eram pra ter 10, havia 200.",
      gravidade: "alta",
      data: "2026-07-21"
    },
    {
      id: "ev-03",
      epoId: "delta",
      epoNome: "EPO Delta",
      item: "Reparo dentro do SLA contratual",
      bloco: "Processo de reparo",
      legenda: "Máquinas paradas há semanas sem previsão de reparo.",
      gravidade: "alta",
      data: "2026-07-22"
    },
    {
      id: "ev-04",
      epoId: "orbita",
      epoNome: "EPO Órbita",
      item: "Estoque físico compatível com o cadastro",
      bloco: "Inventário",
      legenda: "Divergência de inventário - cadastro indicava 15, havia 120.",
      gravidade: "alta",
      data: "2026-07-20"
    },
    {
      id: "ev-05",
      epoId: "aurora",
      epoNome: "EPO Aurora",
      item: "Estoque físico compatível com o cadastro",
      bloco: "Inventário",
      legenda: "Divergência de inventário - eram pra ter 60, havia 48.",
      gravidade: "media",
      data: "2026-07-16"
    },
    {
      id: "ev-06",
      epoId: "farol",
      epoNome: "EPO Farol",
      item: "Reparo dentro do SLA contratual",
      bloco: "Processo de reparo",
      legenda: "Três reparos excederam o SLA em até 1 dia útil.",
      gravidade: "media",
      data: "2026-07-11"
    },
    {
      id: "ev-07",
      epoId: "vertice",
      epoNome: "EPO Vértice",
      item: "Estoque físico compatível com o cadastro",
      bloco: "Inventário",
      legenda: "Divergência de inventário - cadastro indicava 40, havia 34.",
      gravidade: "media",
      data: "2026-07-14"
    },
    {
      id: "ev-08",
      epoId: "litoral",
      epoNome: "EPO Litoral",
      item: "Equipamentos identificados e etiquetados",
      bloco: "Inventário",
      legenda: "Equipamentos sem identificação empilhados no corredor.",
      gravidade: "media",
      data: "2026-07-21"
    },
    {
      id: "ev-09",
      epoId: "meridiano",
      epoNome: "EPO Meridiano",
      item: "Equipamentos identificados e etiquetados",
      bloco: "Inventário",
      legenda: "Lote com etiquetas desbotadas na prateleira B3.",
      gravidade: "baixa",
      data: "2026-07-09"
    }
  ];

  // -----------------------------------------------------------------------
  // Vistorias históricas por EPO (sintéticas - protótipo).
  // Permitem comparar a mesma EPO em datas diferentes (ex.: hoje x 6 meses).
  // -----------------------------------------------------------------------
  var BLOCOS = checklist.map(function (b) { return b.bloco; });

  function seeded(n) {
    var x = Math.sin(n * 999.17) * 43758.5453;
    return x - Math.floor(x); // 0..1 determinístico
  }
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
      var score = Math.round(Math.max(34, Math.min(98, e.score - vb.off * 8)));
      var fator = 1 + vb.off * 0.20; // vistorias antigas: tempos e NCs maiores
      var tc = Math.round(e.tempoChegada * fator * 10) / 10;
      var tr = Math.round(e.tempoReparo * fator * 10) / 10;
      var trt = Math.round(e.tempoRetorno * fator * 10) / 10;
      var secoes = BLOCOS.map(function (bloco, si) {
        var r = seeded(ei * 137 + si * 19 + vi * 7);
        var pct = Math.round(Math.max(28, Math.min(100, score + (r * 34 - 17))));
        return { bloco: bloco, pct: pct };
      });
      return {
        data: vb.data,
        label: vb.label,
        score: score,
        tier: tierDe(score),
        conformidade: score,
        ncs: Math.round(e.ncs * fator),
        tempoChegada: tc,
        tempoReparo: tr,
        tempoRetorno: trt,
        tempoParada: Math.round((tc + tr + trt) * 10) / 10,
        secoes: secoes
      };
    });
  });

  // -----------------------------------------------------------------------
  // Exposição global
  // -----------------------------------------------------------------------
  window.APP = {
    tierRules: tierRules,
    kpis: kpis,
    epos: epos,
    checklist: checklist,
    evidencias: evidencias
  };
})();
