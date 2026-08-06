-- Correcoes da verificacao de seguranca de 06/08/2026.
--
-- Cada item abaixo foi reproduzido antes de corrigir, com sessao simulada do
-- papel em questao, e conferido depois - a prova esta na descricao de cada um.
-- O que esta aqui e o registro; os comandos rodaram no banco.

-- 1) A TAREFA DE AVISOS ESTAVA AO ALCANCE DE QUEM NAO ENTROU
--
-- A migracao dos avisos escreveu "revoke all ... from anon, authenticated". Nao
-- bastou: funcao nasce com EXECUTE concedido a PUBLIC, e PUBLIC vale para todo
-- papel - revogar de anon e de authenticated deixa a concessao a PUBLIC de pe.
-- Reproduzido: com "set local role anon", visitas_para_avisar() respondeu. Com
-- uma visita confirmada ela devolveria e-mail, nome, unidade e endereco de cada
-- responsavel. Depois da correcao: recusada para anon e para authenticated.
revoke all on function public.visitas_para_avisar() from public;
revoke all on function public.visita_aviso_registrar(uuid, text, date, text) from public;

-- 2) OS CORTES DO SELO SAIRAM DO ALCANCE DE QUEM E AUDITADO
--
-- cat_metas_all liberava escrita em metas para quem alcancasse a tela de
-- Checklist, sem olhar o papel - e a matriz da essa tela ao gerente da Claro.
-- Reproduzido: o papel cliente moveu tier_ouro de 85 para 50. metas guarda os
-- cortes ouro/prata/bronze e as metas da reversa: e a regua da nota, e quem e
-- avaliado nao mexe na regua. Depois da correcao: 0 linhas alteradas, valor
-- segue 85, e a leitura continua (o gerente precisa ver os cortes).
drop policy if exists cat_metas_all on public.metas;
drop policy if exists cat_metas_sel on public.metas;
create policy metas_sel on public.metas for select to authenticated
  using (coalesce(papel_atual(), '') <> '');
create policy metas_mut on public.metas for all to authenticated
  using      (coalesce(papel_atual(), '') in ('admin', 'gestor'))
  with check (coalesce(papel_atual(), '') in ('admin', 'gestor'));

-- Os indicadores da reversa sao os numeros medidos contra aquelas metas.
drop policy if exists ir_mut on public.indicadores_reversa;
create policy ir_mut on public.indicadores_reversa for all to authenticated
  using      (coalesce(papel_atual(), '') in ('admin', 'gestor'))
  with check (coalesce(papel_atual(), '') in ('admin', 'gestor')
              and exists (select 1 from epos e where e.id = epo_id));

-- 3) O PESO DA PERGUNTA SAIU DO ALCANCE DO CLIENTE, O TEXTO CONTINUA
--
-- Conflito real entre dois pedidos: a gerencia da Claro precisa editar as
-- perguntas e os topicos (pedido explicito de 04/08), mas o PESO de cada
-- pergunta e parte da regua - com ele da para levantar a nota de um fornecedor
-- aumentando o peso do que ele passa. Politica de RLS nao distingue coluna,
-- entao a separacao vem por gatilho: texto, evidencia esperada, ordem e situacao
-- seguem editaveis por quem alcanca a tela; o peso exige coordenacao da APSIS.
-- Conferido nos dois sentidos: peso recusado, texto da pergunta ainda editavel.
create or replace function public.peso_so_da_coordenacao()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.peso is distinct from old.peso
     and coalesce(papel_atual(), '') not in ('admin', 'gestor') then
    raise exception 'O peso da pergunta e parte do calculo da nota: so a coordenacao da APSIS altera.'
      using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists tg_peso_so_da_coordenacao on public.itens_checklist;
create trigger tg_peso_so_da_coordenacao
  before update on public.itens_checklist
  for each row execute function public.peso_so_da_coordenacao();

-- 4) O RESPONSAVEL DA EPO NAO REAPONTA O PROPRIO PEDIDO PARA OUTRA UNIDADE
--
-- aloc_upd chamava e_responsavel_da_alocacao(id), que rele a linha pelo id. Num
-- UPDATE o id nao muda, entao a funcao respondia sobre a linha ANTIGA, e o
-- WITH CHECK nao restringia coluna nenhuma da linha nova. O responsavel podia
-- trocar epo_id e virar responsavel da unidade de outro fornecedor, porque
-- e_responsavel_da_epo deriva o acesso justamente de alocacoes.epo_id.
-- Conferido: desviar a unidade e trocar o destinatario recusados; marcar o
-- proprio envio continua funcionando (1 linha).
create or replace function public.alocacao_sem_desvio()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(papel_atual(), '') in ('admin', 'gestor') then return new; end if;
  if new.epo_id is distinct from old.epo_id
     or new.processo_id is distinct from old.processo_id
     or lower(btrim(coalesce(new.responsavel_email, ''))) is distinct from
        lower(btrim(coalesce(old.responsavel_email, ''))) then
    raise exception 'Unidade, questionario e destinatario do pedido nao se alteram por aqui.'
      using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists tg_alocacao_sem_desvio on public.alocacoes;
create trigger tg_alocacao_sem_desvio
  before update on public.alocacoes
  for each row execute function public.alocacao_sem_desvio();

-- 5) ANEXO PRECISA APONTAR PARA LINHA QUE EXISTE E ALCANCAVEL
--
-- alanx_ins e alanx_del conferiam papel e origem, mas so o ramo 'epo' resolvia a
-- linha. Nos ramos de admin, Claro e consultor dava para anexar contra qualquer
-- alocacao_id, e apagar todo anexo daquela origem na tabela inteira. O exists
-- roda sob a RLS de quem chama, o que devolve o recorte por cliente.
-- Conferido: anexo como Claro recusado ao responsavel, anexo contra pedido
-- inexistente recusado, apagar anexo do consultor apagou 0, e o anexo proprio
-- continua aceito.
drop policy if exists alanx_ins on public.alocacao_anexos;
create policy alanx_ins on public.alocacao_anexos for insert to authenticated
  with check (
    exists (select 1 from alocacoes a where a.id = alocacao_id)
    and exists (select 1 from itens_checklist i where i.id = item_id)
    and (
      (origem = 'consultor' and e_equipe_apsis()
       and (pode_tela('auditoria') or pode_tela('checagem')))
      or (origem = 'claro' and coalesce(papel_atual(), '') in ('cliente', 'admin'))
      or (origem = 'epo'   and e_responsavel_da_alocacao(alocacao_id))
    )
  );
drop policy if exists alanx_del on public.alocacao_anexos;
create policy alanx_del on public.alocacao_anexos for delete to authenticated
  using (
    exists (select 1 from alocacoes a where a.id = alocacao_id)
    and (
      coalesce(papel_atual(), '') in ('admin', 'gestor')
      or (origem = 'consultor' and e_equipe_apsis())
      or (origem = 'claro' and coalesce(papel_atual(), '') = 'cliente')
      or (origem = 'epo'   and e_responsavel_da_alocacao(alocacao_id))
    )
  );

-- 6) A CONTAGEM FICA NO NOME DE QUEM A FEZ
--
-- cg_ins nao amarrava usuario_id, que vinha do navegador: um fornecedor podia
-- gravar contagem no nome de um auditor da APSIS. A politica irma da mesma
-- migracao ja fazia certo (aud_ins amarra auditor_id = auth.uid()).
-- Conferido: gravar contagem no nome de outra pessoa recusado.
drop policy if exists cg_ins on public.contagens_giro;
create policy cg_ins on public.contagens_giro for insert to authenticated
  with check (
    pode_tela('giro')
    and usuario_id = auth.uid()
    and exists (select 1 from epos e where e.id = epo_id)
  );
