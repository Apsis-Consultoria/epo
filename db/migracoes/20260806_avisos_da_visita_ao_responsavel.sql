-- Avisos da visita para o responsavel da EPO.
--
-- Sao tres: a visita foi marcada, falta uma semana, e amanha. Os dois ultimos
-- saem de uma tarefa diaria, e tarefa diaria repete: sem registro do que ja foi
-- enviado, o responsavel receberia o mesmo lembrete todo dia.
--
-- A chave inclui a DATA da visita de proposito: se a data mudar, os avisos
-- daquela nova data valem de novo. Sem isso, remarcar uma visita deixaria o
-- responsavel sem lembrete nenhum.
create table if not exists public.avisos_visita (
  item_id     uuid not null references cronograma_itens(id) on delete cascade,
  tipo        text not null check (tipo in ('marcada', 'semana', 'dia')),
  data_visita date not null,
  email       text not null,
  enviado_em  timestamptz not null default now(),
  primary key (item_id, tipo, data_visita, email)
);

alter table public.avisos_visita enable row level security;

drop policy if exists avisos_ler on public.avisos_visita;
create policy avisos_ler on public.avisos_visita for select
  using (e_equipe_apsis() or papel_atual() = 'cliente');

revoke all on public.avisos_visita from anon;

-- visitas_para_avisar(): o que precisa ser avisado hoje. Devolve uma linha por
-- RESPONSAVEL, e nao por unidade - a unidade pode ter mais de um, e todos
-- precisam saber. Sai da lista quem ja recebeu aquele aviso para aquela data.
--
-- visita_aviso_registrar(): grava que saiu. Chamada so depois do envio dar
-- certo; registrar antes deixaria a pessoa sem aviso se o e-mail falhasse.
--
-- As duas sao usadas apenas pela funcao avisar-visita, com papel de servico:
-- revogadas de anon e de authenticated. O corpo esta no banco.
