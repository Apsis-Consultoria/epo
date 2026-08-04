-- ===========================================================================
-- Uma unidade pode ter mais de um responsavel, e todos eles entram no sistema.
--
-- Antes o responsavel era um campo da unidade (nome e e-mail), e o acesso vinha
-- de outro lugar: do pedido de questionario, que carrega um e-mail so. Com dois
-- responsaveis, o segundo nao tinha por onde entrar - o pedido era de um deles.
--
-- Agora a lista de responsaveis e da UNIDADE, numa tabela propria, e o acesso
-- deles passa a olhar essa lista. Os campos antigos da unidade continuam
-- valendo como o responsavel principal (o que assina o pedido de questionario),
-- para nao quebrar o que ja le dali.
--
-- Conferido com sessao simulada do SEGUNDO responsavel (o que nao tem pedido no
-- nome dele), tudo desfeito no fim: ve a unidade dele, ve o questionario pedido,
-- anexa como EPO, e nao alcanca unidade alheia.
-- ===========================================================================
create table if not exists public.epo_responsaveis (
  id        uuid primary key default gen_random_uuid(),
  epo_id    uuid not null references epos(id) on delete cascade,
  nome      text,
  email     text not null,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id)
);

create unique index if not exists epo_resp_uk
  on public.epo_responsaveis (epo_id, lower(btrim(email)));
create index if not exists epo_resp_email_idx
  on public.epo_responsaveis (lower(btrim(email)));

comment on table public.epo_responsaveis is
  'Responsaveis de cada unidade. Todos recebem acesso e veem a unidade deles.';

alter table public.epo_responsaveis enable row level security;

drop policy if exists epo_resp_sel on public.epo_responsaveis;
create policy epo_resp_sel on public.epo_responsaveis for select to authenticated
  using (
    e_equipe_apsis()
    or (papel_atual() = 'cliente'
        and epo_id in (select id from epos where cliente_id = cliente_atual()))
    or lower(btrim(email)) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists epo_resp_mut on public.epo_responsaveis;
create policy epo_resp_mut on public.epo_responsaveis for all to authenticated
  using (pode_tela('epos'))
  with check (pode_tela('epos') and exists (select 1 from epos e where e.id = epo_id));

insert into public.epo_responsaveis (epo_id, nome, email)
select e.id, e.responsavel_nome, lower(btrim(e.responsavel_email))
  from epos e
 where coalesce(btrim(e.responsavel_email), '') <> ''
on conflict do nothing;

insert into public.epo_responsaveis (epo_id, nome, email)
select distinct a.epo_id, null, lower(btrim(a.responsavel_email))
  from alocacoes a
 where coalesce(btrim(a.responsavel_email), '') <> ''
on conflict do nothing;

-- Acesso do responsavel: passa a olhar a lista da unidade, alem do pedido.
create or replace function public.e_responsavel_da_epo(eid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select mfa_ok() and (
    exists (
      select 1 from alocacoes a
       where a.epo_id = eid
         and (a.responsavel_user = auth.uid()
              or lower(a.responsavel_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
    )
    or exists (
      select 1 from epo_responsaveis r
       where r.epo_id = eid
         and lower(btrim(r.email)) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
$$;

create or replace function public.e_responsavel_da_alocacao(aid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select mfa_ok() and exists (
    select 1 from alocacoes a
     where a.id = aid
       and (a.responsavel_user = auth.uid()
            or lower(a.responsavel_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
            or exists (
              select 1 from epo_responsaveis r
               where r.epo_id = a.epo_id
                 and lower(btrim(r.email)) = lower(coalesce(auth.jwt() ->> 'email', ''))
            ))
  )
$$;

-- handle_new_user, conta_nova_permitida e sincronizar_papel_responsavel passam a
-- olhar a lista da unidade tambem: sem isso o segundo responsavel recebia o
-- convite e nao conseguia nem criar a conta. As tres estao nas migracoes
-- 20260804_responsavel_da_lista_entra_e_recebe_papel e
-- 20260804_sincronizar_papel_olha_a_lista_de_responsaveis.
