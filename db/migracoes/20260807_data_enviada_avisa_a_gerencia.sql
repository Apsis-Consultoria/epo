-- Quando a APSIS manda uma data para aprovacao, ninguem da Claro fica sabendo.
--
-- O item vai para "Aguardando a Claro" e para ali. A caixa existe na tela do
-- cronograma, mas so quem entra ve - e entrar depende de saber que ha algo
-- esperando. Na pratica o cronograma ficava parado esperando uma pessoa que nao
-- sabia que estava sendo esperada.
--
-- Passa a sair e-mail para a gerencia da Claro. O desenho e o mesmo dos avisos
-- da visita: o banco responde O QUE precisa ser avisado, a funcao manda, e o
-- que saiu fica registrado.
--
-- A chave do registro inclui a DATA enviada. Se a APSIS mudar a data e mandar de
-- novo, e outra coisa para aprovar e o aviso vale outra vez. Sem a data na
-- chave, remarcar deixaria a gerencia sem saber da mudanca.

create table if not exists public.avisos_aprovacao (
  item_id     uuid not null references cronograma_itens(id) on delete cascade,
  data_pedida date not null,
  email       text not null,
  enviado_em  timestamptz not null default now(),
  primary key (item_id, data_pedida, email)
);

alter table public.avisos_aprovacao enable row level security;

drop policy if exists avisos_aprov_ler on public.avisos_aprovacao;
create policy avisos_aprov_ler on public.avisos_aprovacao for select
  using (e_equipe_apsis() or coalesce(papel_atual(), '') = 'cliente');

-- O Supabase concede DML completo ao anon em toda tabela nova.
revoke all on public.avisos_aprovacao from public, anon;
grant select on public.avisos_aprovacao to authenticated;

-- ===========================================================================
-- O QUE ESTA ESPERANDO APROVACAO, E QUEM PRECISA SABER
--
-- Uma linha por GERENTE por item: a Claro tem mais de um gerente e todos
-- respondem pelo cronograma. Quem junta as linhas do mesmo gerente num e-mail so
-- e quem envia - dezenas de e-mails identicos viram spam, e o aviso que chega
-- demais e o aviso que ninguem le.
--
-- Quem entra como gerente: o acesso liberado e ATIVO com papel de cliente. Nao
-- vem de perfis, porque acesso desativado continua tendo perfil - e desativado
-- nao deve receber nada.
create or replace function public.aprovacoes_para_avisar()
returns table(item_id uuid, email text, nome text, unidade text,
              cidade text, uf text, data_inicio date, data_fim date)
language sql
security definer
set search_path to 'public'
as $function$
  select ci.id,
         lower(btrim(a.email)),
         coalesce(nullif(btrim(a.nome), ''), ''),
         e.nome,
         e.cidade,
         e.uf,
         ci.data_prevista_inicio,
         ci.data_prevista_fim
    from cronograma_itens ci
    join epos e on e.id = ci.epo_id
   cross join acessos_autorizados a
   where ci.situacao = 'aguardando_claro'
     and ci.data_prevista_inicio is not null
     and a.papel = 'cliente'
     and a.ativo
     and coalesce(btrim(a.email), '') <> ''
     and not exists (
       select 1 from avisos_aprovacao v
        where v.item_id = ci.id
          and v.data_pedida = ci.data_prevista_inicio
          and v.email = lower(btrim(a.email))
     )
   order by ci.data_prevista_inicio, e.nome;
$function$;

comment on function public.aprovacoes_para_avisar() is
  'Datas esperando a Claro que ainda nao foram avisadas. Uma linha por gerente.';

-- So a credencial de servico chama: e ela que manda o e-mail. Ninguem mais
-- precisa desta lista, e ela nomeia quem e gerente.
revoke all on function public.aprovacoes_para_avisar() from public, anon, authenticated;

create or replace function public.aprovacao_aviso_registrar(
  p_item uuid, p_data date, p_email text)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  insert into avisos_aprovacao (item_id, data_pedida, email)
  values (p_item, p_data, lower(btrim(p_email)))
  on conflict do nothing;
$function$;

revoke all on function public.aprovacao_aviso_registrar(uuid, date, text)
  from public, anon, authenticated;
