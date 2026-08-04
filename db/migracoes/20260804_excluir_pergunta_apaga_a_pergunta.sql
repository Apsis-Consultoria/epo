-- ===========================================================================
-- "Excluir" na tela de Questionarios apagava a pergunta so quando nada dependia
-- dela; havendo resposta ou documento, o botao trocava de acao no meio do
-- caminho e desativava - a pergunta continuava existindo, marcada como inativa,
-- e quem clicou em Excluir tinha de descobrir isso sozinho.
--
-- Passa a apagar mesmo, levando o que estava pendurado NA PERGUNTA. A tela diz
-- na confirmacao quantas respostas e quantos documentos vao embora antes de
-- perguntar se pode.
--
-- Feito no banco, e nao na tela, por dois motivos: a ordem das dependencias tem
-- de ser respeitada (link, anexo, resposta, pergunta) e tudo tem de acontecer
-- numa transacao. Encadeado na tela, uma falha no meio deixaria a pergunta
-- apagada com resposta orfa.
--
-- Quem apaga: coordenacao da APSIS com a tela liberada. Apagar resposta de
-- auditoria nao e acao para o cliente nem para a equipe de campo, mesmo que a
-- matriz libere a tela de questionarios para eles.
-- ===========================================================================
create or replace function public.pergunta_apagar(p_item uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_resp int := 0; v_anx int := 0; v_pergunta text;
begin
  if coalesce(papel_atual(), '') not in ('admin', 'gestor') or not pode_tela('questionarios') then
    raise exception 'Seu acesso nao permite excluir perguntas.' using errcode = '42501';
  end if;

  select pergunta into v_pergunta from itens_checklist where id = p_item;
  if v_pergunta is null then
    raise exception 'Pergunta nao encontrada.' using errcode = 'P0002';
  end if;

  -- Link seguro aponta para a resposta sem cascata: sai primeiro, senao ele
  -- barra a exclusao da resposta.
  delete from links_seguros
   where resposta_id in (select id from respostas where item_id = p_item);

  with x as (delete from alocacao_anexos where item_id = p_item returning 1)
  select count(*) into v_anx from x;

  -- Apagar a resposta leva a evidencia dela por cascata.
  with x as (delete from respostas where item_id = p_item returning 1)
  select count(*) into v_resp from x;

  delete from itens_checklist where id = p_item;

  return jsonb_build_object('pergunta', v_pergunta, 'respostas', v_resp, 'anexos', v_anx);
end $$;

revoke all on function public.pergunta_apagar(uuid) from public;
grant execute on function public.pergunta_apagar(uuid) to authenticated;
