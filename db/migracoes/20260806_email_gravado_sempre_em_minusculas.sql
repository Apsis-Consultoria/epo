-- Endereco de e-mail sempre gravado em minusculas e sem espaco nas pontas.
--
-- Nao e arrumacao de estilo. As funcoes do servidor procuravam a pessoa com
-- ilike, para nao errar por causa de maiuscula. So que ilike e comparacao de
-- PADRAO: % e _ valem como curinga. E "%@apsis.com.br" passava pela conferencia
-- de formato do e-mail, porque \S+ aceita o %. Ou seja, dava para pedir codigo
-- de entrada com um padrao no lugar de um endereco e cair na primeira linha que
-- casasse - a de um administrador, por exemplo. Na limpeza dos codigos era pior:
-- delete ... ilike '%@%' apagaria o codigo de entrada de todo mundo.
--
-- Com o valor normalizado na gravacao, a busca passa a ser eq - comparacao de
-- igualdade, onde % e _ sao apenas caracteres. As funcoes enviar-codigo-entrada,
-- convidar-responsavel e avisar-visita foram publicadas junto, trocando ilike
-- por eq e conferindo o formato num modulo unico (_shared/endereco-email.ts).
create or replace function public.email_em_minusculas()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if to_jsonb(new) ? 'email' then
    new := jsonb_populate_record(new, jsonb_build_object(
      'email', lower(btrim(coalesce(to_jsonb(new) ->> 'email', '')))));
  end if;
  if to_jsonb(new) ? 'responsavel_email' then
    new := jsonb_populate_record(new, jsonb_build_object(
      'responsavel_email', nullif(lower(btrim(coalesce(to_jsonb(new) ->> 'responsavel_email', ''))), '')));
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['acessos_autorizados', 'epo_responsaveis', 'codigos_entrada',
                           'epos', 'alocacoes', 'pedidos_link_senha']
  loop
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = t) then
      execute format('drop trigger if exists tg_email_em_minusculas on public.%I', t);
      execute format('create trigger tg_email_em_minusculas before insert or update '
                     'on public.%I for each row execute function public.email_em_minusculas()', t);
    end if;
  end loop;
end $$;

-- Alinha o que ja esta gravado (na conferencia de 06/08 as cinco tabelas ja
-- estavam corretas; a atualizacao existe para o caso de rodar em outra base).
update acessos_autorizados set email = email where email <> lower(btrim(email));
update epo_responsaveis  set email = email where email <> lower(btrim(email));
update codigos_entrada   set email = email where email <> lower(btrim(email));
update epos      set responsavel_email = responsavel_email
  where responsavel_email <> lower(btrim(responsavel_email));
update alocacoes set responsavel_email = responsavel_email
  where responsavel_email <> lower(btrim(responsavel_email));
