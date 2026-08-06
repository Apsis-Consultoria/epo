-- O aviso de "visita marcada" chegava DEPOIS do lembrete de uma semana.
--
-- O tipo do aviso era decidido so pela distancia ate a visita, nesta ordem:
--
--   data = hoje + 7            -> 'semana'
--   data = hoje + 1            -> 'dia'
--   confirmada_em nao e nulo   -> 'marcada'
--
-- Como cada rodada produz um tipo so por linha, uma visita confirmada faltando
-- exatamente sete dias caia no primeiro ramo: a pessoa recebia "Falta uma
-- semana para a visita" naquele dia. No dia seguinte faltavam seis dias, nenhum
-- dos dois primeiros ramos casava, sobrava o terceiro - e ai chegava "Visita
-- marcada na sua unidade", um dia depois do lembrete. O mesmo acontecia com a
-- visita confirmada na vespera: recebia "A visita e amanha" e, no proprio dia
-- da visita, o aviso de que ela tinha sido marcada.
--
-- A regra agora e explicita e tem prioridade:
--
--   1. enquanto o "marcada" nao tiver saido, e ele que sai;
--   2. depois dele, o lembrete de vespera, se for vespera;
--   3. depois dele, o lembrete de uma semana, se faltar uma semana.
--
-- Assim o aviso de abertura vem sempre primeiro, e nunca depois de um lembrete.
-- Efeito colateral aceito: visita confirmada em cima da hora (vespera ou sete
-- dias antes) recebe o "marcada", que ja leva a data e o pedido, no lugar do
-- lembrete daquele dia.
--
-- O distinct on tambem fecha outra porta: a mesma pessoa podia estar na lista
-- de responsaveis da unidade E no cadastro dela, com o mesmo endereco escrito
-- de dois jeitos. Antes eram duas linhas e dois e-mails iguais; agora e um por
-- pessoa por rodada.
create or replace function public.visitas_para_avisar()
returns table(item_id uuid, tipo text, data_visita date, data_fim date, email text,
              nome text, unidade text, cidade text, uf text, endereco text)
language sql
security definer
set search_path to 'public'
as $function$
  with hoje as (select hoje_br() as d),
  alvo as (
    select ci.id, ci.data_prevista_inicio as ini, ci.data_prevista_fim as fim,
           ci.epo_id, ci.confirmada_em
      from cronograma_itens ci
     where ci.situacao = 'confirmada'
       and ci.data_prevista_inicio is not null
       and ci.data_prevista_inicio >= (select d from hoje)
  ),
  -- Responsavel da unidade: a lista propria da unidade, mais o que ficou
  -- gravado no proprio cadastro dela.
  gente as (
    select a.*, lower(btrim(er.email)) as email, er.nome
      from alvo a join epo_responsaveis er on er.epo_id = a.epo_id
     where coalesce(btrim(er.email), '') <> ''
    union
    select a.*, lower(btrim(e.responsavel_email)), e.responsavel_nome
      from alvo a join epos e on e.id = a.epo_id
     where coalesce(btrim(e.responsavel_email), '') <> ''
  ),
  -- Tudo que caberia hoje para cada pessoa, com a ordem de prioridade.
  candidatos as (
    select g.*, 'marcada'::text as tipo, 1 as ordem from gente g
     where g.confirmada_em is not null
    union all
    select g.*, 'dia'::text, 2 from gente g
     where g.ini = (select d from hoje) + 1
    union all
    select g.*, 'semana'::text, 3 from gente g
     where g.ini = (select d from hoje) + 7
  ),
  -- Tira o que ja saiu e deixa um aviso por pessoa por rodada.
  pendentes as (
    select distinct on (c.id, c.email) c.*
      from candidatos c
     where not exists (
       select 1 from avisos_visita av
        where av.item_id = c.id and av.tipo = c.tipo
          and av.data_visita = c.ini and av.email = c.email
     )
     order by c.id, c.email, c.ordem
  )
  select p.id, p.tipo, p.ini, p.fim, p.email, coalesce(p.nome, ''),
         e.nome, coalesce(e.cidade, ''), coalesce(e.uf, ''), coalesce(e.endereco, '')
    from pendentes p join epos e on e.id = p.epo_id;
$function$;
