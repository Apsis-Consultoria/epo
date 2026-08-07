-- Segunda rodada da verificacao de seguranca (07/08/2026).
--
-- Cada item foi reproduzido antes de corrigir, com sessao simulada do papel em
-- questao, e conferido depois. O que esta aqui e o registro; os comandos rodaram
-- no banco.

-- ===========================================================================
-- 1) QUEM ABRE UMA AUDITORIA E DA EQUIPE DA APSIS, E ELA NASCE EM BRANCO
--
-- aud_ins exigia apenas pode_tela('auditoria') e auditor_id = auth.uid(). A
-- matriz de acessos da a tela de auditoria ao papel 'cliente' - a gerencia da
-- contratante, parte interessada no resultado. A porta estava aberta para quem e
-- avaliado avaliar.
--
-- Reproduzido: um unico INSERT do papel cliente, com status 'enviada',
-- score 99.9 e tier 'ouro', criou auditoria SELADA, que entrou no acervo lido
-- por nota, ranking, mapa e comparativo, e gerou ZERO linhas de historico. Nao
-- foi preciso responder uma pergunta.
--
-- Duas travas: a identidade de quem audita fica na POLITICA e nao na matriz (a
-- matriz e editavel por tela, um clique reabriria o buraco); e a auditoria nasce
-- em branco, sem nota, sem selo, sem data de envio. A nota so aparece pelo
-- UPDATE que sela, depois das respostas. Nao quebra o uso legitimo: a tela grava
-- o cabecalho como rascunho e so depois sela.
drop policy if exists aud_ins on public.auditorias;
create policy aud_ins on public.auditorias for insert to authenticated
  with check (
    e_equipe_apsis()
    and pode_tela('auditoria')
    and auditor_id = auth.uid()
    and status = 'rascunho'
    and score is null
    and tier is null
    and enviada_em is null
    and exists (select 1 from epos e where e.id = epo_id)
  );

-- ===========================================================================
-- 2) O RASTRO DA AUDITORIA FECHADA
--
-- Quatro furos no mesmo rastro: as politicas de resposta, evidencia e tempo eram
-- FOR ALL (o DELETE passava pela porta do UPDATE); o gatilho do historico era so
-- AFTER UPDATE (apagar e reinserir mudava a nota sem deixar linha); o gatilho
-- volta cedo em rascunho e o status era livre (validada -> rascunho -> edita ->
-- validada silenciava o registro); e apagar a auditoria levava o historico junto
-- pelo ON DELETE CASCADE.
--
-- Conferido depois: apagar resposta de auditoria fechada afeta 0 linhas, voltar
-- para rascunho e recusado, apagar auditoria fechada afeta 0 linhas, e resposta
-- incluida em auditoria fechada gera 1 linha de historico.
drop policy if exists resp_mut on public.respostas;
create policy resp_ins on public.respostas for insert to authenticated
  with check (pode_editar_auditoria(auditoria_id));
create policy resp_upd on public.respostas for update to authenticated
  using      (pode_editar_auditoria(auditoria_id))
  with check (pode_editar_auditoria(auditoria_id));
create policy resp_del on public.respostas for delete to authenticated
  using (pode_editar_auditoria(auditoria_id)
         and exists (select 1 from auditorias a
                      where a.id = auditoria_id and a.status = 'rascunho'));

drop policy if exists ev_mut on public.evidencias;
create policy ev_ins on public.evidencias for insert to authenticated
  with check (exists (select 1 from respostas r
                       where r.id = resposta_id and pode_editar_auditoria(r.auditoria_id)));
create policy ev_upd on public.evidencias for update to authenticated
  using      (exists (select 1 from respostas r
                       where r.id = resposta_id and pode_editar_auditoria(r.auditoria_id)))
  with check (exists (select 1 from respostas r
                       where r.id = resposta_id and pode_editar_auditoria(r.auditoria_id)));
create policy ev_del on public.evidencias for delete to authenticated
  using (exists (select 1 from respostas r join auditorias a on a.id = r.auditoria_id
                  where r.id = resposta_id and pode_editar_auditoria(r.auditoria_id)
                    and a.status = 'rascunho'));

drop policy if exists tc_mut on public.tempos_ciclo;
create policy tc_ins on public.tempos_ciclo for insert to authenticated
  with check (pode_editar_auditoria(auditoria_id));
create policy tc_upd on public.tempos_ciclo for update to authenticated
  using      (pode_editar_auditoria(auditoria_id))
  with check (pode_editar_auditoria(auditoria_id));
create policy tc_del on public.tempos_ciclo for delete to authenticated
  using (pode_editar_auditoria(auditoria_id)
         and exists (select 1 from auditorias a
                      where a.id = auditoria_id and a.status = 'rascunho'));

drop policy if exists aud_del on public.auditorias;
create policy aud_del on public.auditorias for delete to authenticated
  using (coalesce(papel_atual(), '') in ('admin', 'gestor') and status = 'rascunho');

create or replace function public.auditoria_nao_volta_para_rascunho()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if old.status <> 'rascunho' and new.status = 'rascunho' then
    raise exception 'Auditoria ja enviada nao volta para rascunho. Para corrigir, registre uma auditoria nova.'
      using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists tg_auditoria_sem_regresso on public.auditorias;
create trigger tg_auditoria_sem_regresso
  before update on public.auditorias
  for each row execute function public.auditoria_nao_volta_para_rascunho();

create or replace function public.registrar_entrada_saida_de_resposta()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_aud uuid; v_status text;
begin
  v_aud := coalesce(new.auditoria_id, old.auditoria_id);
  select status into v_status from auditorias where id = v_aud;
  if coalesce(v_status, '') = 'rascunho' then return coalesce(new, old); end if;

  if tg_op = 'INSERT' then
    insert into auditoria_historico(auditoria_id, resposta_id, campo, de, para, quem)
    values (v_aud, new.id, 'resposta incluida', null, new.status, auth.uid());
  else
    insert into auditoria_historico(auditoria_id, resposta_id, campo, de, para, quem)
    values (v_aud, null, 'resposta removida', old.status, null, auth.uid());
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists tg_hist_resposta_entrada on public.respostas;
create trigger tg_hist_resposta_entrada
  after insert on public.respostas
  for each row execute function public.registrar_entrada_saida_de_resposta();
drop trigger if exists tg_hist_resposta_saida on public.respostas;
create trigger tg_hist_resposta_saida
  before delete on public.respostas
  for each row execute function public.registrar_entrada_saida_de_resposta();

-- evidencias guarda storage_path e NAO tem nome_arquivo (esse campo e da outra
-- tabela de anexos). Escrito errado, o gatilho so quebraria na hora de apagar
-- uma evidencia de auditoria fechada - justamente o caminho que ele registra.
create or replace function public.registrar_entrada_saida_de_evidencia()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_aud uuid; v_status text; v_resp uuid;
begin
  v_resp := coalesce(new.resposta_id, old.resposta_id);
  select r.auditoria_id, a.status into v_aud, v_status
    from respostas r join auditorias a on a.id = r.auditoria_id where r.id = v_resp;
  if v_aud is null or coalesce(v_status, '') = 'rascunho' then return coalesce(new, old); end if;

  insert into auditoria_historico(auditoria_id, resposta_id, campo, de, para, quem)
  values (v_aud, v_resp,
          case when tg_op = 'INSERT' then 'evidencia incluida' else 'evidencia removida' end,
          case when tg_op = 'INSERT' then null else old.storage_path end,
          case when tg_op = 'INSERT' then new.storage_path else null end,
          auth.uid());
  return coalesce(new, old);
end $$;
drop trigger if exists tg_hist_evidencia_entrada on public.evidencias;
create trigger tg_hist_evidencia_entrada
  after insert on public.evidencias
  for each row execute function public.registrar_entrada_saida_de_evidencia();
drop trigger if exists tg_hist_evidencia_saida on public.evidencias;
create trigger tg_hist_evidencia_saida
  before delete on public.evidencias
  for each row execute function public.registrar_entrada_saida_de_evidencia();

-- ===========================================================================
-- 3) A FUNCAO QUE CARIMBAVA O PROPRIO SEGUNDO FATOR
--
-- marcar_senha_trocada() sobrou do tempo em que havia senha neste sistema.
-- Gravava perfis.senha_provisoria = false e, de passagem, escrevia em
-- sessoes_confirmadas - a tabela que mfa_ok() consulta para decidir se a sessao
-- passou pelo codigo de seis digitos. A unica barreira era "auth.uid() is null".
--
-- Reproduzido numa sessao de entrada por senha, com sessao real em auth.sessions:
--   antes:  mfa_ok = false, papel_atual() = nulo   (nao alcanca nada)
--   depois: mfa_ok = true,  papel_atual() = cliente (alcanca tudo do papel)
-- Uma chamada, sem digitar codigo nenhum.
--
-- O furo era real e nao teorico: as 5 contas do projeto TEM senha definida no
-- servico de contas, entao a entrada por senha existe, e para ela
-- mfa_dispensada() nao vale - o segundo fator era a unica porta.
-- Nenhuma tela e nenhuma funcao do banco chamava.
drop function if exists public.marcar_senha_trocada();

-- ===========================================================================
-- 4) DESATIVAR ALGUEM PRECISA GRUDAR
--
-- sincronizar_papel_responsavel roda a cada carregamento de tela e promove a
-- 'responsavel' quem aparece como responsavel de alguma unidade. A lista de
-- excecoes era ('admin','gestor','responsavel') - 'sem_acesso' nao estava nela,
-- e 'sem_acesso' e exatamente o que a administracao grava ao desativar.
-- Desativar quem continua cadastrado como responsavel nao tinha efeito nenhum.
--
-- Conferido: desativado devolve 'sem_acesso'; reativado volta a 'responsavel'.
create or replace function public.sincronizar_papel_responsavel()
returns text language plpgsql security definer set search_path to 'public' as $function$
declare v_email text; v_e_responsavel boolean;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email',''));
  if v_email = '' then return papel_atual(); end if;

  if exists (select 1 from acessos_autorizados
              where lower(btrim(email)) = v_email and ativo = false) then
    return papel_atual();
  end if;

  v_e_responsavel :=
    exists (select 1 from alocacoes where lower(responsavel_email) = v_email)
    or exists (select 1 from epo_responsaveis where lower(btrim(email)) = v_email);

  if v_e_responsavel then
    update alocacoes set responsavel_user = auth.uid()
      where lower(responsavel_email) = v_email and responsavel_user is null;
    if v_email not like '%@apsis.com.br' then
      update perfis set papel = 'responsavel',
        cliente_id = coalesce(cliente_id, (select id from clientes where slug='claro'))
        where user_id = auth.uid() and papel not in ('admin','gestor','responsavel');
    end if;
  end if;
  return papel_atual();
end $function$;

-- ===========================================================================
-- 5) O PESO DO PROCESSO E REGUA, COMO O PESO DA PERGUNTA
--
-- A rodada anterior trancou itens_checklist.peso. processos.peso ficou de fora,
-- e ele e o peso de cada processo na nota consolidada da unidade: a mesma regua,
-- um nivel acima. A mesma funcao de gatilho serve as duas tabelas.
drop trigger if exists tg_peso_so_da_coordenacao on public.processos;
create trigger tg_peso_so_da_coordenacao
  before update on public.processos
  for each row execute function public.peso_so_da_coordenacao();

-- ===========================================================================
-- 6) APAGAR PERGUNTA SEGUE A REGRA QUE A FUNCAO E A TELA JA DIZIAM
--
-- questionario_apagar e pergunta_apagar exigem admin ou gestor, e a tela esconde
-- o botao. Mas cat_itens_all e cat_proc_all eram FOR ALL com a condicao unica
-- pode_tela('questionarios'), que a matriz da ao papel cliente: a mesma exclusao
-- que a funcao recusa passava por DELETE direto na tabela.
--
-- So o DELETE muda. Incluir e editar continua liberado para quem alcanca a tela
-- - isso e intencional. Conferido: peso recusado, exclusao 0 linhas, e edicao de
-- pergunta e de processo seguem funcionando.
drop policy if exists cat_itens_all on public.itens_checklist;
create policy cat_itens_ins on public.itens_checklist for insert to authenticated
  with check (pode_tela('questionarios'));
create policy cat_itens_upd on public.itens_checklist for update to authenticated
  using      (pode_tela('questionarios'))
  with check (pode_tela('questionarios'));
create policy cat_itens_del on public.itens_checklist for delete to authenticated
  using (coalesce(papel_atual(), '') in ('admin', 'gestor'));

drop policy if exists cat_proc_all on public.processos;
create policy cat_proc_ins on public.processos for insert to authenticated
  with check (pode_tela('questionarios'));
create policy cat_proc_upd on public.processos for update to authenticated
  using      (pode_tela('questionarios'))
  with check (pode_tela('questionarios'));
create policy cat_proc_del on public.processos for delete to authenticated
  using (coalesce(papel_atual(), '') in ('admin', 'gestor'));
