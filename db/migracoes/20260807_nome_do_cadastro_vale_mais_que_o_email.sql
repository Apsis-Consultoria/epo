-- O nome que aparece na tela de acessos era o pedaco do e-mail antes do @.
--
-- Quem libera um acesso digita o nome da pessoa. Esse nome ficava so em
-- acessos_autorizados, e a lista "Contas de acesso" da tela le perfis - onde o
-- nome e preenchido por handle_new_user, que cai em split_part(email,'@',1)
-- quando a conta entra sem nome vindo do provedor. Resultado: "filipeoliveiralipe"
-- no lugar de "Filipe Oliveira".
--
-- Nao da para resolver na tela: perfis nao guarda e-mail, entao a tela nao tem
-- como cruzar as duas listas. O nome tem de estar certo na origem.

-- ===========================================================================
-- 1) CONTA NOVA NASCE COM O NOME DO CADASTRO
--
-- A funcao ja lia a linha de acessos_autorizados para decidir papel e cliente.
-- Passa a ler o nome tambem, e a ordem de preferencia fica explicita:
--   o nome do cadastro  ->  o nome que o provedor mandou  ->  o pedaco do e-mail
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_papel   text;
  v_cliente uuid;
  v_email   text;
  v_nome    text;
  v_aut     record;
begin
  v_email := lower(btrim(coalesce(new.email, '')));

  update alocacoes set responsavel_user = new.id
   where lower(responsavel_email) = v_email and responsavel_user is null;

  select papel, cliente_id, ativo, nome into v_aut
    from acessos_autorizados
   where lower(btrim(email)) = v_email
   limit 1;

  if v_aut.papel is not null and v_aut.ativo then
    v_papel := v_aut.papel;
    v_cliente := v_aut.cliente_id;
    if v_papel = 'cliente' and v_cliente is null then
      select id into v_cliente from clientes where slug = 'claro';
    end if;

  elsif v_aut.papel is not null then
    v_papel := 'sem_acesso';
    v_cliente := null;

  elsif exists (select 1 from epo_responsaveis where lower(btrim(email)) = v_email)
     or exists (select 1 from alocacoes where lower(responsavel_email) = v_email) then
    v_papel := 'responsavel';
    select id into v_cliente from clientes where slug = 'claro';

  else
    -- Inclusive o dominio da propria casa: quem entra pela primeira vez espera
    -- a liberacao, em vez de ja nascer com o papel que produz laudo.
    v_papel := 'sem_acesso';
    v_cliente := null;
  end if;

  -- O nome do cadastro na frente. Quem liberou o acesso escreveu o nome da
  -- pessoa; o provedor manda o que tem; o e-mail e o ultimo recurso, e e o unico
  -- que produz coisa como "filipeoliveiralipe".
  v_nome := coalesce(
    nullif(btrim(coalesce(v_aut.nome, '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), ''),
    split_part(v_email, '@', 1)
  );

  insert into perfis (user_id, nome, papel, cliente_id)
  values (new.id, v_nome, v_papel, v_cliente)
  on conflict (user_id) do nothing;
  return new;
end $function$;

-- ===========================================================================
-- 2) ALTERAR O NOME NO CADASTRO ALTERA O NOME NA TELA
--
-- Gatilho proprio, e nao um remendo no acessos_espelha_perfil que ja existe:
-- aquele cuida do papel e da situacao, e mexer nele as cegas para acrescentar
-- nome e o tipo de alteracao que quebra o que estava certo.
--
-- So preenche quando ha nome no cadastro, e nunca apaga o que ja esta no perfil:
-- limpar o campo na tela de acessos nao pode apagar o nome de quem ja usa o
-- sistema.
create or replace function public.acessos_espelha_nome()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_nome text;
begin
  v_nome := nullif(btrim(coalesce(new.nome, '')), '');
  if v_nome is null then return new; end if;

  update perfis p
     set nome = v_nome
    from auth.users u
   where u.id = p.user_id
     and lower(btrim(u.email)) = lower(btrim(new.email))
     and coalesce(p.nome, '') is distinct from v_nome;

  return new;
end $function$;

drop trigger if exists tg_acessos_espelha_nome on public.acessos_autorizados;
create trigger tg_acessos_espelha_nome
  after insert or update of nome, email on public.acessos_autorizados
  for each row execute function public.acessos_espelha_nome();

-- ===========================================================================
-- 3) O QUE JA ESTA GRAVADO
--
-- Corrige quem ja tem conta e ja tem nome no cadastro. So mexe onde o perfil
-- discorda do cadastro; quem nao tem linha em acessos_autorizados fica como
-- esta, porque nao ha nome melhor para colocar.
update perfis p
   set nome = nullif(btrim(a.nome), '')
  from acessos_autorizados a
  join auth.users u on lower(btrim(u.email)) = lower(btrim(a.email))
 where p.user_id = u.id
   and nullif(btrim(coalesce(a.nome, '')), '') is not null
   and coalesce(p.nome, '') is distinct from btrim(a.nome);
