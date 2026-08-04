-- ===========================================================================
-- Excluir questionario.
--
-- Regra: questionario com RESPOSTA de auditoria nao e apagado - fica a
-- desativacao, que tira ele das auditorias novas e mantem o historico. Sem
-- nenhuma resposta (o caso do questionario criado para teste) ele e apagado de
-- verdade, levando o que estava pendurado nele e nunca foi respondido: as
-- perguntas, os pedidos de questionario e os rascunhos vazios.
--
-- A recusa fica DENTRO da funcao, e nao so na tela: assim nao existe caminho -
-- nem pela tela, nem por chamada direta - que apague resultado de auditoria por
-- este botao.
--
-- Feito no banco por causa da ordem das dependencias (link, rascunho, pedido,
-- anexo, pergunta, questionario), que tem de valer inteira ou nao valer.
--
-- Conferido com sessao simulada de coordenacao, tudo desfeito no fim:
--   questionario de teste (1 pergunta, 1 pedido, 1 rascunho, nenhuma resposta)
--     -> apagado, nada orfao;
--   questionario com 1 resposta -> recusado, resposta intacta.
-- ===========================================================================
create or replace function public.questionario_apagar(p_processo uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_nome text; v_resp int; v_aud int := 0; v_ped int := 0; v_itens int := 0;
begin
  if coalesce(papel_atual(), '') not in ('admin', 'gestor') or not pode_tela('questionarios') then
    raise exception 'Seu acesso nao permite excluir questionarios.' using errcode = '42501';
  end if;

  select nome into v_nome from processos where id = p_processo;
  if v_nome is null then
    raise exception 'Questionario nao encontrado.' using errcode = 'P0002';
  end if;

  select count(*) into v_resp
    from respostas r
   where r.item_id in (select id from itens_checklist where processo_id = p_processo);

  if v_resp > 0 then
    raise exception 'Este questionario tem % resposta(s) de auditoria: desative em vez de apagar.',
      v_resp using errcode = '23514';
  end if;

  delete from links_seguros
   where auditoria_id in (select id from auditorias where processo_id = p_processo);

  with x as (delete from auditorias where processo_id = p_processo returning 1)
  select count(*) into v_aud from x;

  with x as (delete from alocacoes where processo_id = p_processo returning 1)
  select count(*) into v_ped from x;

  delete from alocacao_anexos
   where item_id in (select id from itens_checklist where processo_id = p_processo);

  with x as (delete from itens_checklist where processo_id = p_processo returning 1)
  select count(*) into v_itens from x;

  delete from processos where id = p_processo;

  return jsonb_build_object('nome', v_nome, 'perguntas', v_itens,
                            'rascunhos', v_aud, 'pedidos', v_ped);
end $$;

revoke all on function public.questionario_apagar(uuid) from public;
grant execute on function public.questionario_apagar(uuid) to authenticated;
