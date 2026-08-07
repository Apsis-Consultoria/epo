-- Apagar do cronograma.
--
-- Ate aqui so havia "Tirar do ciclo": a unidade sai da lista, o historico fica e
-- da para trazer de volta. Serve para a unidade que nao entra neste ciclo, e nao
-- para a linha que entrou errada - a linha errada continuava na tela, marcada
-- como fora do ciclo, dizendo que houve uma decisao que nunca houve.
--
-- Este apaga de verdade, e por isso e mais estreito que o resto da tela:
--
--   1. So a APSIS. A Claro aprova e sugere data; apagar o cronograma dela nao.
--   2. Nao apaga visita que aconteceu. Auditoria realizada e evidencia: apagar a
--      linha apagaria o registro de que a visita houve, quem registrou e quando.
--      Para esse caso "Tirar do ciclo" continua sendo a resposta, e ele preserva
--      o historico.

create or replace function public.cronograma_apagar(p_item uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_situacao text;
  v_auditoria uuid;
  v_nome text;
begin
  if not e_equipe_apsis() then
    raise exception 'somente a APSIS apaga item do cronograma';
  end if;

  select ci.situacao, ci.auditoria_id, e.nome
    into v_situacao, v_auditoria, v_nome
    from cronograma_itens ci
    join epos e on e.id = ci.epo_id
   where ci.id = p_item;

  if v_situacao is null then
    raise exception 'este item do cronograma nao existe mais';
  end if;

  if v_situacao = 'realizada' or v_auditoria is not null then
    raise exception 'a visita desta unidade ja foi registrada e nao pode ser apagada. Use "Tirar do ciclo"';
  end if;

  -- Os avisos ja enviados vao junto pela propria chave estrangeira
  -- (on delete cascade). O historico e apagado aqui porque ele so descreve
  -- este item: mantido, ficaria um fio de eventos sem a linha que ele conta.
  delete from cronograma_eventos where item_id = p_item;
  delete from cronograma_itens where id = p_item;
end $function$;

comment on function public.cronograma_apagar(uuid) is
  'Apaga um item do cronograma. So a APSIS, e nunca visita ja realizada.';

-- O Supabase concede EXECUTE ao anon em toda funcao nova de public. Sem este
-- revoke, apagar cronograma ficaria ao alcance de quem nem entrou - a funcao e
-- security definer, entao ela nao seria barrada pelas politicas da tabela.
revoke all on function public.cronograma_apagar(uuid) from public, anon;
grant execute on function public.cronograma_apagar(uuid) to authenticated;
