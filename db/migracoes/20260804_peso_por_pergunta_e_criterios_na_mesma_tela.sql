-- ===========================================================================
-- Peso por pergunta, cortes do selo gravados, e as duas telas viraram uma.
--
-- O peso existia por questionario e nao era usado por nada: a tela de Criterios
-- mostrava os controles e nao gravava (era prototipo), e a nota sempre saiu como
-- porcentagem simples das perguntas conformes. Agora o peso e da PERGUNTA, fica
-- gravado, e entra na conta - a nota passa a ser media ponderada.
--
-- Padrao 1 em todas: com todos os pesos iguais, media ponderada e media simples,
-- entao nenhuma nota ja calculada muda de valor. So muda quando alguem decidir
-- que uma pergunta pesa mais.
-- ===========================================================================
alter table itens_checklist
  add column if not exists peso numeric(6,2) not null default 1
    check (peso > 0 and peso <= 100);

comment on column itens_checklist.peso is
  'Quanto esta pergunta pesa na nota do questionario. Padrao 1 (todas iguais).';

-- Cortes do selo: saem do codigo da tela e passam a ficar gravados, na mesma
-- tabela de metas que ja guarda os alvos da reversa. Antes, mexer nos cortes e
-- recarregar devolvia o que estava escrito no codigo.
insert into metas (cliente_id, chave, valor)
select c.id, x.chave, x.valor
  from clientes c
 cross join (values ('tier_ouro', 85), ('tier_prata', 70), ('tier_bronze', 55)) as x(chave, valor)
on conflict (cliente_id, chave) do nothing;

-- A tela de Criterios da nota virou a primeira secao da tela de Questionarios:
-- e a mesma decisao, e estava partida em duas telas. Com isso a chave
-- 'criterios' da matriz deixa de existir - quem alcanca Questionarios alcanca os
-- criterios. Chave que a matriz nao desenha e chave que ninguem consegue mudar,
-- que foi o que aconteceu com 'envio' e 'config'.
drop policy if exists cat_metas_all on metas;
create policy cat_metas_all on metas for all to authenticated
  using (pode_tela('questionarios'))
  with check (pode_tela('questionarios'));

drop policy if exists ir_mut on indicadores_reversa;
create policy ir_mut on indicadores_reversa for all to authenticated
  using (pode_tela('questionarios'))
  with check (pode_tela('questionarios'));

delete from permissoes_papel where tela = 'criterios';

alter table permissoes_papel drop constraint if exists perm_tela_chk;
alter table permissoes_papel add constraint perm_tela_chk
  check (tela in ('geral', 'epos', 'cronograma', 'ranking', 'comparativo', 'gerencial',
                  'pendentes', 'realizadas', 'auditoria', 'checagem', 'questionarios',
                  'alocacoes', 'giro', 'evidencias', 'acessos'));
