-- Notas das EPOs para o piloto.
--
-- O mapa da visao geral mostra a medalha da ULTIMA vistoria de cada EPO. Com o
-- banco sem nenhuma vistoria, toda EPO aparece como "sem vistoria" (pino neutro
-- e regiao sem cor), ainda que a tela de demonstracao mostre as medalhas.
-- Este script leva as notas da carteira para o banco, casando pelo nome da EPO.
--
-- Onde rodar: painel do Supabase > SQL Editor > New query > colar > Run.
-- Pode rodar mais de uma vez: EPO que ja tem vistoria e ignorada.
--
-- A linha fica com status 'validada' e presa ao processo de maior peso
-- (Logistica Reversa), que e o portador da nota consolidada enquanto as
-- auditorias de verdade nao comecarem. EPO sem nota aqui (a EPO de teste, por
-- exemplo) continua como "sem vistoria", que e o certo.

with notas (nome, score, tier) as (
  values
    ('EPO Meridiano',        92, 'ouro'),
    ('EPO Farol',            90, 'ouro'),
    ('EPO Vértice',          88, 'ouro'),
    ('EPO Aurora',           83, 'prata'),
    ('EPO Nexus',            79, 'prata'),
    ('EPO Órbita',           74, 'prata'),
    ('EPO Litoral',          66, 'bronze'),
    ('EPO Delta',            48, 'critico'),
    ('EPO Cerrado (teste)',  68, 'bronze')
),
proc as (
  select id from public.processos
  where slug = 'reversa' and ativo
  order by ordem
  limit 1
)
insert into public.auditorias
  (epo_id, processo_id, auditor_id, data_visita, status, score, tier, enviada_em, observacoes)
select
  e.id,
  proc.id,
  null,
  date '2026-07-18',
  'validada',
  n.score,
  n.tier,
  timestamptz '2026-07-18 18:00-03',
  'Nota da carteira carregada para o piloto.'
from notas n
join public.epos e on e.nome = n.nome and e.ativo
cross join proc
where not exists (
  select 1 from public.auditorias a
  where a.epo_id = e.id and a.status in ('enviada', 'validada')
);

-- Conferencia: como o mapa vai ler cada EPO
select e.nome, e.uf, a.score, a.tier, a.data_visita,
       case when a.id is null then 'sem vistoria' else 'com medalha' end as no_mapa
from public.epos e
left join public.auditorias a
  on a.epo_id = e.id and a.status in ('enviada', 'validada')
where e.ativo
order by a.score desc nulls last, e.nome;
