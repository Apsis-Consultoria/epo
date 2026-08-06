-- Antecedencia minima para marcar a visita: hoje mais tres dias.
--
-- A visita nao pode ser marcada de um dia para o outro: e preciso avisar o
-- responsavel da EPO, ele juntar o que foi pedido e a equipe se deslocar.
-- Marcando numa quinta, o primeiro dia livre e o domingo - quinta, sexta e
-- sabado ficam fora.
--
-- A regra fica aqui, e nao so no campo da tela, porque campo de tela se
-- contorna: basta chamar o endereco direto. A tela le o mesmo numero
-- (DIAS_DE_ANTECEDENCIA em cronograma.html e em assets/form-epo.js).
--
-- Vale para as duas pontas da conversa: a data que a APSIS define e a que a
-- Claro sugere. Fica FORA a data realizada (o que ja aconteceu) e a importacao
-- por planilha.
create or replace function public.dias_de_antecedencia() returns int
language sql immutable as $$ select 3 $$;

comment on function public.dias_de_antecedencia() is
  'Dias entre hoje e a primeira data em que a visita pode ser marcada. A tela usa o mesmo numero.';

-- As duas funcoes que gravam data ganharam, no inicio, a conferencia:
--
--   v_min := current_date + dias_de_antecedencia();
--   if p_inicio < v_min then
--     raise exception 'A visita precisa ser marcada com pelo menos % dias de
--       antecedencia: a partir de %.', dias_de_antecedencia(),
--       to_char(v_min, 'DD/MM/YYYY') using errcode = '23514';
--   end if;
--
-- O corpo completo das duas esta no banco; aqui fica o registro do que mudou e
-- do motivo. Ver cronograma_definir_data e cronograma_propor_data.
