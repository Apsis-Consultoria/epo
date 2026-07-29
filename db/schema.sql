-- ============================================================================
-- Auditoria de EPOs — schema proposto (Supabase / Postgres)
-- Rascunho para validação. Reflete o modelo pós-reunião Claro 27/07/2026:
--   checklists por PROCESSO, evidência obrigatória com justificativa,
--   link seguro para anexos, indicadores de reversa, multi-cliente.
-- Aplicar via migrations quando o MCP do Supabase estiver conectado.
-- ============================================================================

-- ---------------------------------------------------------------- Clientes
create table clientes (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,          -- ex.: 'claro'
  nome        text not null,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- -------------------------------------------------------------------- EPOs
create table epos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references clientes(id),
  nome        text not null,
  cidade      text,
  uf          char(2),
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- ------------------------------------------------- Processos (checklists)
-- Cada processo é um checklist independente com peso na nota final.
create table processos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references clientes(id),
  slug        text not null,                 -- 'recebimento', 'devolucao'...
  nome        text not null,
  descricao   text,
  icone       text,
  peso        numeric(5,2) not null default 0,  -- pesos do cliente somam 100
  ordem       int not null default 0,
  tipo        text not null default 'processo'  -- 'processo' | 'itens_obrigatorios' (carregadores)
    check (tipo in ('processo','itens_obrigatorios')),
  ativo       boolean not null default true,
  unique (cliente_id, slug)
);

create table itens_checklist (
  id                 uuid primary key default gen_random_uuid(),
  processo_id        uuid not null references processos(id),
  pergunta           text not null,
  evidencia_esperada text,                   -- se preenchido => evidência obrigatória
  requer_foto        boolean not null default false,
  grave              boolean not null default false, -- NC grave (ex.: login compartilhado)
  ordem              int not null default 0,
  ativo              boolean not null default true
);

-- -------------------------------------------------------------- Auditorias
-- Uma auditoria = um processo aplicado a uma EPO numa visita.
create table auditorias (
  id             uuid primary key default gen_random_uuid(),
  epo_id         uuid not null references epos(id),
  processo_id    uuid not null references processos(id),
  auditor_id     uuid references auth.users(id),
  data_visita    date not null,
  status         text not null default 'rascunho'
    check (status in ('rascunho','enviada','validada')),
  score          numeric(5,2),               -- 0-100 (exibido tb como 0-1)
  tier           text check (tier in ('ouro','prata','bronze','critico')),
  resp_epo       text,                       -- assinatura responsável EPO
  resp_claro     text,                       -- assinatura responsável Claro
  observacoes    text,
  enviada_em     timestamptz,
  criado_em      timestamptz not null default now()
);

-- Tempos do ciclo do material (SEM reparo — fluxo real da EPO), em dias.
create table tempos_ciclo (
  auditoria_id   uuid primary key references auditorias(id) on delete cascade,
  chegada        numeric(6,1),
  armazenagem    numeric(6,1),
  distribuicao   numeric(6,1),
  retorno_campo  numeric(6,1),
  devolucao      numeric(6,1)
);

-- --------------------------------------------------------------- Respostas
create table respostas (
  id             uuid primary key default gen_random_uuid(),
  auditoria_id   uuid not null references auditorias(id) on delete cascade,
  item_id        uuid not null references itens_checklist(id),
  status         text not null
    check (status in ('conforme','nao_conforme','na','presente','ausente')),
  observacao     text,
  justificativa  text,   -- obrigatória quando avança sem evidência / item ausente
  unique (auditoria_id, item_id)
);

-- --------------------------------------------------------------- Evidências
-- Arquivos no Storage (bucket privado 'evidencias').
create table evidencias (
  id            uuid primary key default gen_random_uuid(),
  resposta_id   uuid not null references respostas(id) on delete cascade,
  storage_path  text not null,
  tipo          text not null default 'foto' check (tipo in ('foto','arquivo')),
  origem        text not null default 'consultor'
    check (origem in ('consultor','link_seguro')),
  criado_em     timestamptz not null default now()
);

-- ------------------------------------------------------------ Link seguro
-- Link temporário (estilo Secure Share): o responsável da EPO sobe anexos
-- (e-mail, prints do Atlas, NF) sem nada passar pelo celular do consultor.
create table links_seguros (
  id            uuid primary key default gen_random_uuid(),
  auditoria_id  uuid not null references auditorias(id) on delete cascade,
  resposta_id   uuid references respostas(id),
  token         text unique not null,
  expira_em     timestamptz not null,        -- ex.: now() + interval '24 hours'
  usado_em      timestamptz,
  criado_em     timestamptz not null default now()
);

-- ------------------------------------------- Indicadores de reversa (Claro)
-- Alimentado pela base da Claro (alto giro, fontes, controles) por período.
create table indicadores_reversa (
  id                   uuid primary key default gen_random_uuid(),
  epo_id               uuid not null references epos(id),
  periodo              date not null,        -- 1º dia do mês
  aderencia_calendario numeric(5,2),         -- % devoluções no dia agendado
  volume_devolvido     int,
  saldo_sistema        int,
  equip_alto_giro      int,
  fontes_devolvidas    int,
  controles_devolvidos int,
  pct_fontes           numeric(5,2),         -- meta padrão 75
  pct_controles        numeric(5,2),
  unique (epo_id, periodo)
);

-- ------------------------------------------------------------------- Metas
create table metas (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references clientes(id),
  chave       text not null,                 -- 'pct_fontes', 'pct_controles'
  valor       numeric(8,2) not null,         -- 75
  unique (cliente_id, chave)
);

-- ---------------------------------------------------------------- Perfis
create table perfis (
  user_id     uuid primary key references auth.users(id),
  nome        text,
  papel       text not null default 'auditor'
    check (papel in ('admin','gestor','auditor','cliente')),
  cliente_id  uuid references clientes(id)   -- para papel = 'cliente'
);

-- ============================================================================
-- RLS (resumo — políticas detalhadas na migration):
--  * admin/gestor APSIS: tudo.
--  * auditor: CRUD nas próprias auditorias (rascunho); leitura do catálogo.
--  * cliente (Claro): SOMENTE leitura de auditorias enviadas/validadas do seu
--    cliente_id (dashboards/ranking) — nunca rascunhos.
--  * links_seguros: acesso anônimo apenas via edge function validando token
--    não expirado (upload no bucket 'evidencias' com prefixo do link).
-- Storage: bucket privado 'evidencias' (fotos/arquivos), políticas por papel.
-- ============================================================================
