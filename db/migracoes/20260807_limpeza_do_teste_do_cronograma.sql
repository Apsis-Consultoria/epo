-- Limpeza do que foi criado testando o cronograma.
--
-- O que ficou: as UNIDADES (epos) - nome, codigo, cidade, UF, endereco, CEP -,
-- o catalogo de checklist, as metas, os clientes e as contas da APSIS.
--
-- O que sai: tudo que foi gerado em cima das unidades durante o teste. O caso
-- que motivou isto: ao cadastrar uma EPO, o formulario voltava com responsaveis
-- que ja tinham sido "apagados". Eles nao tinham sido - o formulario le de TRES
-- lugares diferentes, e so um deles havia sido limpo:
--
--   1. epo_responsaveis      - a lista de responsaveis da unidade;
--   2. epos.responsavel_nome / epos.responsavel_email - o par que a unidade
--      guarda desde antes de existir a lista;
--   3. alocacoes             - o pedido de questionario, de onde vinham tambem
--      a data da visita e a observacao que reapareciam no formulario.
--
-- Limpar um so deixava os outros dois preenchendo a tela de volta.
--
-- Ao final imprime a contagem do que sobrou, para conferir sem outra consulta.
--
-- Rodar duas vezes nao faz diferenca: os delete ja nao acham nada e os update
-- so mexem no que ainda esta preenchido.
--
-- ATENCAO: nao tem desfazer.

begin;

-- ===========================================================================
-- 1) RESPOSTAS E AUDITORIAS
--
-- Vem primeiro porque tudo depende delas. cronograma_itens aponta para
-- auditorias, entao a ligacao e desfeita antes de a auditoria sair.
delete from respostas;
delete from auditoria_historico;
update cronograma_itens set auditoria_id = null where auditoria_id is not null;
delete from auditorias;

-- ===========================================================================
-- 2) PEDIDOS DE QUESTIONARIO E O QUE FOI ANEXADO
--
-- alocacoes e um dos tres lugares de onde o formulario puxava responsavel: ele
-- guarda responsavel_email, a data da visita e a observacao de cada pedido.
delete from alocacao_anexos;
delete from alocacoes;

-- ===========================================================================
-- 3) CRONOGRAMA
--
-- Os avisos ja enviados sairiam sozinhos pela chave estrangeira, mas saem
-- nomeados: assim a limpeza diz o que faz, em vez de depender de um efeito.
delete from avisos_aprovacao;
delete from avisos_visita;
delete from cronograma_eventos;
delete from cronograma_itens;
delete from cronograma_importacoes;

-- ===========================================================================
-- 4) CONTAGEM DA REVERSA E EVIDENCIAS
delete from contagem_giro_itens;
delete from contagens_giro;
delete from evidencias;

-- Os arquivos em si (o cofre "evidencias") NAO saem por aqui de proposito:
-- apagar a linha por SQL deixaria o arquivo la sem nada apontando para ele.
-- Sem estas linhas o sistema ja nao alcanca arquivo nenhum. Para tirar os
-- arquivos tambem, use Storage > evidencias no painel do projeto.

-- ===========================================================================
-- 5) OS RESPONSAVEIS
--
-- A lista da unidade, e tambem o par antigo gravado na propria unidade. O
-- segundo e o que fazia o formulario voltar preenchido mesmo com a lista vazia.
delete from epo_responsaveis;

update epos
   set responsavel_nome = null,
       responsavel_email = null
 where responsavel_nome is not null
    or responsavel_email is not null;

-- ===========================================================================
-- 6) OS ACESSOS DE TESTE
--
-- Responsavel de unidade so existe por causa da unidade: sem cronograma e sem
-- pedido, o acesso dele nao tem do que tratar. A gerencia da Claro e a APSIS
-- ficam - esses acessos sao de gente, e nao do teste.
delete from acessos_autorizados where papel = 'responsavel';

commit;

-- ===========================================================================
-- 7) AS CONTAS QUE SOBRARAM DO TESTE
--
-- Transacao SEPARADA de proposito. Apagar conta pode esbarrar em chave
-- estrangeira de tabela que nao esta nesta lista, e se isso acontecer aqui a
-- limpeza de cima - que e a que resolve o problema do formulario - ja esta
-- gravada e nao volta atras junto.
--
-- Sai quem entrou uma vez durante o teste e nao tem mais acesso liberado. Fica
-- toda conta que ainda esta na lista de acessos: a APSIS e a gerencia da Claro.
--
-- Sem tabela temporaria de apoio: o editor de SQL do painel manda os comandos
-- em conexoes que podem nao ser a mesma, e a tabela temporaria criada num
-- comando nao existe no seguinte. Cada comando abaixo se basta.
begin;

-- Primeiro o perfil. Enquanto ele existe, a conta nao sai: e ele que aponta
-- para ela.
delete from perfis p
 where p.papel in ('responsavel', 'sem_acesso')
   and not exists (
     select 1
       from auth.users u
       join acessos_autorizados a
         on lower(btrim(a.email)) = lower(btrim(u.email))
      where u.id = p.user_id
   );

-- Solta TUDO que ainda aponta para conta sem perfil.
--
-- Escrito assim, e nao como uma lista de tabelas, porque a lista envelhece: a
-- tabela criada no mes que vem aponta para a conta e ninguem lembra de vir aqui
-- acrescentar. Uma unica referencia esquecida derruba o delete seguinte.
--
-- Percorre as chaves estrangeiras que apontam para auth.users e limpa as que
-- aceitam vazio. As que nao aceitam ficam de fora de proposito: coluna
-- obrigatoria significa que aquela linha nao existe sem a conta, e aparecer um
-- erro ali e melhor do que apagar a linha por conta propria.
do $limpa$
declare r record;
begin
  for r in
    select c.conrelid::regclass::text as tabela, a.attname as coluna
      from pg_constraint c
      join unnest(c.conkey) as k(num) on true
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.num
     where c.contype = 'f'
       and c.confrelid = 'auth.users'::regclass
       and c.conrelid::regclass::text not like 'auth.%'
       and not a.attnotnull
  loop
    execute format(
      'update %s set %I = null where %I is not null and not exists ' ||
      '(select 1 from perfis p where p.user_id = %s.%I)',
      r.tabela, r.coluna, r.coluna, r.tabela, r.coluna);
  end loop;
end $limpa$;

-- Agora a conta. Duas condicoes, e nao uma: conta sem perfil E fora da lista de
-- acessos. Toda conta de verdade nasce com perfil (handle_new_user), entao o
-- que sobra aqui e o rastro do teste - e a segunda condicao garante que nenhuma
-- conta ainda liberada saia por acidente.
delete from auth.users u
 where not exists (select 1 from perfis p where p.user_id = u.id)
   and not exists (
     select 1 from acessos_autorizados a
      where lower(btrim(a.email)) = lower(btrim(u.email))
   );

commit;

-- ===========================================================================
-- 8) O QUE SOBROU
--
-- Uma linha por tabela. Zero em tudo que era do teste, e as unidades intactas.
-- Fica por ultimo porque o editor mostra o resultado da ultima consulta.
select 'unidades (mantidas)' as o_que, count(*) as quantas from epos
union all select 'contas (mantidas)',             count(*) from perfis
union all select 'acessos liberados (mantidos)',  count(*) from acessos_autorizados
union all select 'responsaveis da unidade',       count(*) from epo_responsaveis
union all select 'unidades com responsavel solto', count(*) from epos
            where responsavel_nome is not null or responsavel_email is not null
union all select 'itens de cronograma',           count(*) from cronograma_itens
union all select 'eventos de cronograma',         count(*) from cronograma_eventos
union all select 'importacoes de cronograma',     count(*) from cronograma_importacoes
union all select 'pedidos de questionario',       count(*) from alocacoes
union all select 'anexos dos pedidos',            count(*) from alocacao_anexos
union all select 'auditorias',                    count(*) from auditorias
union all select 'respostas',                     count(*) from respostas
union all select 'contagens da reversa',          count(*) from contagens_giro
union all select 'evidencias',                    count(*) from evidencias
union all select 'avisos de visita',              count(*) from avisos_visita
union all select 'avisos de aprovacao',           count(*) from avisos_aprovacao
order by 1;
