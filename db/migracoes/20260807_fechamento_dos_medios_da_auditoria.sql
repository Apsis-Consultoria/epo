-- Fechamento dos achados medios da verificacao de seguranca (07/08/2026).
-- Continuacao de 20260807_independencia_do_avaliador_e_rastro_da_auditoria.sql.

-- ===========================================================================
-- 1) O COFRE DE ARQUIVOS PASSA A CONFERIR O CAMINHO
--
-- ev_storage_sel era: bucket = 'evidencias' e (equipe APSIS ou dono ou papel
-- cliente). O caminho do arquivo nao entrava na decisao. No banco, o acesso do
-- cliente as evidencias passa por pode_ver_auditoria, que so mostra auditoria
-- 'enviada' ou 'validada' e apenas das unidades do contrato dele; no cofre esse
-- recorte nao existia - dava para baixar evidencia de auditoria em rascunho, de
-- qualquer unidade, sabendo o caminho.
--
-- Os caminhos sao auditorias/<id>/<item>/arquivo, alocacoes/<id>/<item>/arquivo
-- e contagens/<id>/arquivo. O segundo pedaco e sempre um id.
create or replace function public.id_do_caminho(p_caminho text, p_pedaco int)
returns uuid language plpgsql immutable set search_path to 'public' as $$
begin
  return nullif(split_part(p_caminho, '/', p_pedaco), '')::uuid;
exception when others then
  -- O predicado e avaliado em TODA linha do cofre: um cast invalido num caminho
  -- fora do padrao mataria a consulta inteira em vez de negar aquela linha.
  return null;
end $$;

drop policy if exists ev_storage_sel on storage.objects;
create policy ev_storage_sel on storage.objects for select to authenticated
using (
  bucket_id = 'evidencias'
  and (
    e_equipe_apsis()
    -- Os exists correm sob a RLS de quem chama, entao o recorte por contratante
    -- e por situacao da auditoria vem de graca, igual ao do banco.
    or (name like 'auditorias/%' and pode_ver_auditoria(id_do_caminho(name, 2)))
    or (name like 'alocacoes/%'
        and exists (select 1 from alocacoes a where a.id = id_do_caminho(name, 2)))
    or (name like 'contagens/%'
        and exists (select 1 from contagens_giro c where c.id = id_do_caminho(name, 2)))
    or owner = auth.uid()
  )
);

-- O autor nao apaga mais evidencia de auditoria ja selada: era o mesmo furo do
-- rastro, um andar abaixo. Apagar o arquivo esvazia a evidencia sem tocar na
-- linha que o historico observa.
drop policy if exists ev_storage_del on storage.objects;
create policy ev_storage_del on storage.objects for delete to authenticated
using (
  bucket_id = 'evidencias'
  and (
    coalesce(papel_atual(), '') in ('admin', 'gestor')
    or (owner = auth.uid()
        and (name not like 'auditorias/%'
             or exists (select 1 from auditorias a
                         where a.id = id_do_caminho(name, 2) and a.status = 'rascunho')))
  )
);

-- ===========================================================================
-- 2) CADASTRAR CONTATO DE UNIDADE DEIXA DE SER PORTA DE ENTRADA LARGA
--
-- Estar em epo_responsaveis vale como acesso liberado. E epo_resp_mut era FOR
-- ALL com pode_tela('epos'), tela que a matriz da ao cliente e ao auditor.
-- O papel concedido por esse caminho e so 'responsavel', preso a unidade - nao e
-- escalada para administracao. O que fecha aqui sao as duas bordas afiadas.
drop policy if exists epo_resp_mut on public.epo_responsaveis;
create policy epo_resp_ins on public.epo_responsaveis for insert to authenticated
  with check (
    pode_tela('epos')
    and exists (select 1 from epos e where e.id = epo_id)
    and (coalesce(papel_atual(), '') in ('admin', 'gestor')
         or lower(btrim(coalesce(email, ''))) not like '%@apsis.com.br')
  );
create policy epo_resp_upd on public.epo_responsaveis for update to authenticated
  using (pode_tela('epos') and exists (select 1 from epos e where e.id = epo_id))
  with check (
    pode_tela('epos')
    and exists (select 1 from epos e where e.id = epo_id)
    and (coalesce(papel_atual(), '') in ('admin', 'gestor')
         or lower(btrim(coalesce(email, ''))) not like '%@apsis.com.br')
  );
create policy epo_resp_del on public.epo_responsaveis for delete to authenticated
  using (pode_tela('epos') and exists (select 1 from epos e where e.id = epo_id));

-- ===========================================================================
-- 3) A UNIDADE SO E ALTERADA POR QUEM RESPONDE POR ELA
--
-- epos_alterar e epos_incluir pediam apenas pode_tela('epos'), sem recorte por
-- contratante: o cliente enxerga so as unidades do contrato dele, mas escrevia
-- em qualquer uma, inclusive nas que nao ve.
drop policy if exists epos_alterar on public.epos;
create policy epos_alterar on public.epos for update to authenticated
  using (pode_tela('epos') and (e_equipe_apsis() or cliente_id = cliente_atual()))
  with check (pode_tela('epos') and (e_equipe_apsis() or cliente_id = cliente_atual()));
drop policy if exists epos_incluir on public.epos;
create policy epos_incluir on public.epos for insert to authenticated
  with check (pode_tela('epos') and (e_equipe_apsis() or cliente_id = cliente_atual()));

-- ===========================================================================
-- 4) MONTAR O CRONOGRAMA E DA COORDENACAO, COMO A TELA JA DIZIA
--
-- cronograma.html esconde nova data, incluir unidade, importar planilha,
-- cancelar e reabrir de quem nao e admin nem gestor. No servidor, essas funcoes
-- conferiam so pode_tela('cronograma'), e a matriz da essa tela ao cliente.
-- Duas irmas da mesma familia (cronograma_aprovar e cronograma_propor_data) ja
-- conferiam papel - eram a prova de que a intencao era essa.
--
-- A troca foi feita dentro de cada funcao, sem mudar mais nada do corpo delas:
--   if not pode_tela('cronograma')
-- virou
--   if coalesce(papel_atual(), '') not in ('admin','gestor')
-- em cronograma_definir_data, cronograma_incluir, cronograma_importar,
-- cronograma_enviar_aprovacao, cronograma_cancelar, cronograma_reabrir e
-- cronograma_aceitar_proposta.

-- ===========================================================================
-- 5) CONTA DO DOMINIO DA CASA NASCE SEM ACESSO
--
-- handle_new_user dava papel 'auditor' a qualquer endereco terminado em
-- @apsis.com.br que nao estivesse na lista de acessos. E 'auditor' e equipe de
-- campo: abre auditoria. Quem recebesse e-mail num endereco do dominio ganhava,
-- sozinho, o papel que produz laudo. Agora nasce 'sem_acesso' e alguem libera na
-- tela de Gerenciamento de acessos. Contas que ja existem nao mudam de papel.

-- ===========================================================================
-- 6) OBJETO NOVO DEIXA DE NASCER ABERTO
--
-- O privilegio padrao do projeto concedia EXECUTE a anon em TODA funcao nova de
-- public, e DML completo a anon em TODA tabela nova. Foi por essa rede que a
-- funcao dos avisos ficou ao alcance de quem nao entrou, e que
-- marcar_senha_trocada ficou chamavel por qualquer sessao.
--
-- authenticated continua com EXECUTE por padrao, de proposito: o PostgREST chama
-- as funcoes das telas com essa identidade. A protecao das funcoes para quem
-- esta logado e o papel conferido dentro delas, nao o privilegio.
--
-- Depois disto: 0 de 62 funcoes do schema public alcancaveis por anon.
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
alter default privileges in schema public
  revoke insert, update, delete, truncate on tables from anon;
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate on tables from anon;

-- E o que ja existia: funcao de gatilho nao e chamada por ninguem de fora - o
-- Postgres a executa por conta propria quando a linha muda. Ter EXECUTE nelas so
-- serve para quem quer chama-las na mao com um registro forjado no argumento.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as assinatura
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.assinatura);
  end loop;

  -- Lista de concessoes vazia significa "todo mundo executa": e preciso revogar
  -- de PUBLIC, e nao so de anon, para a lista passar a existir.
  for r in
    select p.oid::regprocedure::text as assinatura
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and (p.proacl is null or exists (
             select 1 from aclexplode(p.proacl) a
              where a.grantee in (0, 'anon'::regrole) and a.privilege_type = 'EXECUTE'))
  loop
    execute format('revoke all on function %s from public, anon', r.assinatura);
    execute format('grant execute on function %s to authenticated, service_role', r.assinatura);
  end loop;
end $$;

-- ===========================================================================
-- 7) TETO DIARIO DE CODIGOS DE ENTRADA
--
-- O freio era de um por minuto e nada alem: 1.440 codigos por dia para o mesmo
-- endereco, cada um um e-mail com a marca da Claro na caixa de quem nao pediu
-- nada. Um por minuto atrapalha quem tenta adivinhar; nao atrapalha quem quer
-- encher a caixa de alguem. Vinte por dia cobre o uso de verdade.
create table if not exists public.codigos_entrada_emitidos (
  id bigserial primary key,
  email text not null,
  emitido_em timestamptz not null default now()
);
create index if not exists ix_codigos_emitidos_email_data
  on public.codigos_entrada_emitidos (email, emitido_em desc);
alter table public.codigos_entrada_emitidos enable row level security;
revoke all on table public.codigos_entrada_emitidos from anon, authenticated;
-- Sem politica nenhuma: ninguem que entra pela API alcanca esta tabela. Quem
-- escreve nela e codigo_entrada_registrar, que roda como dona.

-- O registro do teto vive separado do codigo em si: o codigo e apagado quando e
-- usado, expira ou e trocado, e o teto precisa lembrar do que ja saiu.
-- (o corpo de codigo_entrada_registrar esta no banco; a mudanca foi acrescentar
--  a contagem das ultimas 24 horas antes de gerar o codigo)

-- ===========================================================================
-- 8) A TAREFA DIARIA PASSA A EXIGIR UM SEGREDO PROPRIO
--
-- O caminho da tarefa em avisar-visita nao conferia nada: bastava um POST com
-- corpo vazio e a chave publicavel, que esta no JavaScript do site.
--
-- O segredo mora no banco, numa tabela que so a credencial de servico alcanca.
-- Nao vai para o corpo da funcao SQL - pg_get_functiondef e legivel por qualquer
-- papel do banco, entao escrever o segredo la seria trocar um endereco aberto
-- por um segredo publicado.
create table if not exists public.segredos_internos (
  chave text primary key,
  valor text not null,
  criado_em timestamptz not null default now()
);
alter table public.segredos_internos enable row level security;
revoke all on table public.segredos_internos from anon, authenticated;

insert into public.segredos_internos (chave, valor)
  values ('tarefa_avisos', encode(extensions.gen_random_bytes(32), 'hex'))
  on conflict (chave) do nothing;

create or replace function public.tarefa_avisos_autorizada(p_valor text)
returns boolean language sql security definer stable set search_path to 'public' as $$
  select exists (select 1 from segredos_internos
                  where chave = 'tarefa_avisos'
                    and valor = coalesce(p_valor, '')
                    and length(coalesce(p_valor, '')) > 0);
$$;
revoke all on function public.tarefa_avisos_autorizada(text) from public, anon, authenticated;
grant execute on function public.tarefa_avisos_autorizada(text) to service_role;

-- ===========================================================================
-- 9) O CATALOGO DA REVERSA SAI DO REPOSITORIO PUBLICO
--
-- Estava em assets/catalogo-giro.js: 1.064 codigos SAP do cliente, com
-- tecnologia, tipo e categoria de cada um. O repositorio e publico, e o SITE
-- tambem servia o arquivo, sem login, porque a tela de contagem depende dele.
-- Repositorio privado resolveria o primeiro caso e nao o segundo.
create table if not exists public.catalogo_giro (
  cod  text primary key,
  tec  text,
  tipo text,
  giro text,
  cat  text
);
alter table public.catalogo_giro enable row level security;

drop policy if exists catgiro_ler on public.catalogo_giro;
create policy catgiro_ler on public.catalogo_giro for select to authenticated
  using (pode_tela('giro') or e_equipe_apsis());

-- Escrever no catalogo e mexer na base de comparacao da contagem: coordenacao.
drop policy if exists catgiro_mut on public.catalogo_giro;
create policy catgiro_mut on public.catalogo_giro for all to authenticated
  using      (coalesce(papel_atual(), '') in ('admin', 'gestor'))
  with check (coalesce(papel_atual(), '') in ('admin', 'gestor'));

revoke all on table public.catalogo_giro from anon;
-- Os 1.064 itens foram carregados a partir do arquivo antigo. assets/catalogo-giro.js
-- passou a ser so o carregador, que le desta tabela.

-- ===========================================================================
-- 10) O RESPONSAVEL DE UMA UNIDADE NAO ENXERGA O CONTRATO INTEIRO
--
-- cliente_atual() devolve o cliente_id do perfil sem olhar o papel, e o
-- responsavel de uma EPO tem esse campo preenchido. Toda politica escrita como
-- "cliente_id = cliente_atual()" o tratava como se ele fosse a gerencia do
-- contrato - inclusive indicadores_reversa, que sao os numeros medidos de CADA
-- unidade. O responsavel de uma EPO via os das concorrentes dele.
--
-- A correcao e no recorte, e nao em cliente_atual(): o vinculo dele com o
-- contratante esta certo, o que faltava era a lista ser por unidade. processos
-- (o catalogo de questionarios) fica como esta: ele precisa ver a estrutura do
-- checklist para saber o que anexar. Conferido: passou a ver 0 indicadores e 0
-- importacoes, e continua vendo os 9 questionarios.
drop policy if exists ir_sel on public.indicadores_reversa;
create policy ir_sel on public.indicadores_reversa for select to authenticated
  using (
    e_equipe_apsis()
    or (papel_atual() = 'cliente'
        and epo_id in (select id from epos where cliente_id = cliente_atual()))
    or e_responsavel_da_epo(epo_id)
  );

drop policy if exists cron_importacoes_sel on public.cronograma_importacoes;
create policy cron_importacoes_sel on public.cronograma_importacoes for select to authenticated
  using (e_equipe_apsis()
         or (papel_atual() = 'cliente' and cliente_id = cliente_atual()));

-- Concessoes de tabela que nao servem a ninguem: anon perde SELECT e todo o DML
-- em todas as tabelas e views do schema. A RLS ja barrava; a concessao existir
-- so serve para o dia em que alguem criar uma tabela e esquecer a RLS.
do $$
declare r record;
begin
  for r in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
  loop
    execute format('revoke select, insert, update, delete, truncate on public.%I from anon',
                   r.relname);
  end loop;
end $$;

-- ===========================================================================
-- 11) CODIGO ERRADO PAUSA, EM VEZ DE APAGAR
--
-- Errar cinco vezes APAGAVA o codigo, e era isso que permitia trancar alguem:
-- quem soubesse o endereco de uma pessoa esperava ela pedir o codigo e mandava
-- cinco numeros errados. A pessoa certa, com o numero certo na mao, ouvia "nao
-- ha codigo em aberto". Repetindo a cada minuto, o acesso ficava trancado para
-- sempre, com seis requisicoes por minuto e nenhuma credencial.
--
-- Agora a quinta tentativa errada PAUSA por um minuto e o codigo continua de pe.
-- Quem tem o numero certo espera e entra; quem atrapalha consegue adiar, nao
-- impedir. Nao abre a porta para adivinhacao: o codigo vale dez minutos, entao
-- sao no maximo cinquenta chutes em um milhao - 0,005% por codigo. O freio de
-- verdade contra adivinhacao sempre foi a validade curta.
--
-- Conferido: apos 5 erros o codigo continua no banco, o certo e recusado durante
-- a pausa, e aceito depois dela.
alter table public.codigos_entrada
  add column if not exists travado_ate timestamptz;
-- (o corpo de codigo_entrada_conferir esta no banco: troca o delete pela pausa,
--  e zera o contador quando a pausa termina)
