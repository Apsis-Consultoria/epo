-- ===========================================================================
-- Achados na varredura dos dois questionarios em passos (Preenchimento e
-- Contagem da Logistica Reversa), que nao abrem sem dados reais e por isso
-- foram testados pelo lado do servidor.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) A contagem da Logistica Reversa nao podia ser enviada por quem a preenche.
--
-- Mesmo erro que travou o envio da auditoria: a regra de alteracao tinha
-- somente a parte "quais linhas posso mexer" e nenhuma parte "como a linha pode
-- ficar". Sem a segunda, o banco aplica a primeira TAMBEM na linha nova - e a
-- primeira exigia rascunho. Enviar e justamente deixar de ser rascunho, entao o
-- ultimo botao do questionario recusava para todo mundo que nao administra nem
-- coordena: equipe de campo e responsavel da EPO.
--
--   quais linhas posso mexer  -> a minha, enquanto for rascunho;
--   como ela pode ficar       -> rascunho ou enviada, e nada alem disso.
-- ---------------------------------------------------------------------------
drop policy if exists cg_upd on contagens_giro;
create policy cg_upd on contagens_giro for update to authenticated
  using (
    coalesce(papel_atual(), '') in ('admin', 'gestor')
    or (usuario_id = auth.uid() and status = 'rascunho')
  )
  with check (
    coalesce(papel_atual(), '') in ('admin', 'gestor')
    or (usuario_id = auth.uid() and status in ('rascunho', 'enviada'))
  );

-- Aqui a parte que faltava nao mudava nada (nenhuma coluna do teste muda com a
-- alteracao), mas fica escrita: e a mesma armadilha, e o proximo a mexer nao
-- precisa descobrir de novo.
drop policy if exists aloc_upd on alocacoes;
create policy aloc_upd on alocacoes for update to authenticated
  using (pode_tela('epos') or pode_tela('alocacoes') or e_responsavel_da_alocacao(id))
  with check (pode_tela('epos') or pode_tela('alocacoes') or e_responsavel_da_alocacao(id));

-- ---------------------------------------------------------------------------
-- 2) Gravar apontando para EPO que a pessoa nao pode nem ver.
--
-- As regras de insercao pediam a tela ('giro', 'auditoria', 'epos'/'alocacoes')
-- e paravam ai: nada exigia que a EPO da linha fosse uma das que a pessoa
-- alcanca. Na tela isso nao acontece, porque a lista de EPOs ja vem filtrada -
-- mas quem montasse o pedido a mao criaria contagem, auditoria ou pedido de
-- questionario pendurado em unidade alheia.
--
-- O "exists" abaixo le a tabela de EPOs COM as regras de quem esta pedindo:
-- para a APSIS sao todas, para a Claro as do cliente dela, para o responsavel
-- somente as dele. Uma linha resolve os tres casos.
-- ---------------------------------------------------------------------------
drop policy if exists cg_ins on contagens_giro;
create policy cg_ins on contagens_giro for insert to authenticated
  with check (
    pode_tela('giro')
    and exists (select 1 from epos e where e.id = epo_id)
  );

drop policy if exists aud_ins on auditorias;
create policy aud_ins on auditorias for insert to authenticated
  with check (
    pode_tela('auditoria')
    and auditor_id = auth.uid()
    and exists (select 1 from epos e where e.id = epo_id)
  );

drop policy if exists aloc_ins on alocacoes;
create policy aloc_ins on alocacoes for insert to authenticated
  with check (
    (pode_tela('epos') or pode_tela('alocacoes'))
    and exists (select 1 from epos e where e.id = epo_id)
  );
