-- ===========================================================================
-- Corrigir resposta na tela de Auditorias realizadas.
--
-- Quem corrige e a coordenacao. Nao foi escolha nova: era ja o que as regras
-- permitiam - pode_editar_auditoria() libera admin e gestor a qualquer momento,
-- e o autor somente enquanto a auditoria e rascunho. Depois de enviada, a
-- resposta deixou de ser dele.
--
-- Correcao em auditoria ja enviada nao pode acontecer em silencio: resultado
-- comunicado que muda sem rastro nao se sustenta, e a independencia de quem
-- avalia depende de o antes e o depois ficarem visiveis. Cada mudanca fica
-- registrada com o valor de antes, o de depois, quem mudou e quando - e quem
-- registra e o proprio banco, por gatilho, nao a tela: assim nao depende de
-- quem chama.
-- ===========================================================================
create table if not exists public.auditoria_historico (
  id           uuid primary key default gen_random_uuid(),
  auditoria_id uuid not null references auditorias(id) on delete cascade,
  resposta_id  uuid,
  campo        text not null,
  de           text,
  para         text,
  quem         uuid references auth.users(id),
  quando       timestamptz not null default now()
);

create index if not exists hist_aud_idx on public.auditoria_historico (auditoria_id, quando desc);

comment on table public.auditoria_historico is
  'Rastro de correcao em auditoria: valor de antes, de depois, quem e quando.';

alter table public.auditoria_historico enable row level security;

-- Le quem ja pode ver a auditoria. Ninguem escreve daqui: a escrita e do
-- gatilho, e o gatilho roda como dono da tabela.
drop policy if exists hist_sel on public.auditoria_historico;
create policy hist_sel on public.auditoria_historico for select to authenticated
  using (pode_ver_auditoria(auditoria_id));

create or replace function public.registrar_edicao_resposta()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from auditorias where id = new.auditoria_id;

  -- Rascunho e o preenchimento em curso: registrar cada tecla ali nao e rastro,
  -- e ruido. O rastro comeca quando a auditoria ja foi enviada.
  if coalesce(v_status, '') = 'rascunho' then
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into auditoria_historico(auditoria_id, resposta_id, campo, de, para, quem)
    values (new.auditoria_id, new.id, 'resposta', old.status, new.status, auth.uid());
  end if;

  if coalesce(new.observacao, '') is distinct from coalesce(old.observacao, '') then
    insert into auditoria_historico(auditoria_id, resposta_id, campo, de, para, quem)
    values (new.auditoria_id, new.id, 'observacao', old.observacao, new.observacao, auth.uid());
  end if;

  if coalesce(new.justificativa, '') is distinct from coalesce(old.justificativa, '') then
    insert into auditoria_historico(auditoria_id, resposta_id, campo, de, para, quem)
    values (new.auditoria_id, new.id, 'justificativa', old.justificativa, new.justificativa, auth.uid());
  end if;

  return new;
end $$;

drop trigger if exists trg_hist_resposta on public.respostas;
create trigger trg_hist_resposta
  after update on public.respostas
  for each row execute function registrar_edicao_resposta();

create or replace function public.registrar_edicao_auditoria()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Nota e situacao da auditoria: a nota muda porque as respostas mudaram, e a
  -- validacao cai quando a resposta que a sustentava foi corrigida.
  if old.status <> 'rascunho' then
    if new.score is distinct from old.score then
      insert into auditoria_historico(auditoria_id, campo, de, para, quem)
      values (new.id, 'nota',
              case when old.score is null then null else round(old.score)::text end,
              case when new.score is null then null else round(new.score)::text end,
              auth.uid());
    end if;
    if new.status is distinct from old.status then
      insert into auditoria_historico(auditoria_id, campo, de, para, quem)
      values (new.id, 'situacao', old.status, new.status, auth.uid());
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_hist_auditoria on public.auditorias;
create trigger trg_hist_auditoria
  after update on public.auditorias
  for each row execute function registrar_edicao_auditoria();
