-- ===========================================================================
-- Botao que aparece e o servidor recusa: quatro casos, achados varrendo cada
-- botao com sessao simulada de cada cargo.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Ninguem da APSIS conseguia anexar evidencia.
--
-- A tela grava a origem do arquivo para separar as tres caixas (APSIS, Claro,
-- EPO) e manda 'consultor' quando quem envia e da APSIS. A tabela so aceitava
-- 'claro' e 'epo': o arquivo subia e a linha era recusada, um por um. Com o
-- cargo de campo dava 42501 (a regra barrava antes); com coordenacao dava
-- 23514 (a regra passava e a coluna barrava). O fim era o mesmo.
-- ---------------------------------------------------------------------------
alter table alocacao_anexos drop constraint if exists alocacao_anexos_origem_valida;
alter table alocacao_anexos add constraint alocacao_anexos_origem_valida
  check (origem in ('consultor', 'claro', 'epo'));

-- A regra de insercao pedia a tela de Evidencias para quem anexa como
-- consultor. Só que a equipe de campo anexa de dentro do questionario, e
-- aquela tela nao e a dela: o pedido era de uma permissao que o trabalho dela
-- nao inclui. Passa a valer qualquer uma das duas telas, e so para a APSIS -
-- sem o teste de equipe, o responsavel da EPO com Evidencias liberada poderia
-- anexar como se fosse consultor.
drop policy if exists alanx_ins on alocacao_anexos;
create policy alanx_ins on alocacao_anexos for insert to authenticated
  with check (
    coalesce(papel_atual(), '') = 'admin'
    or (origem = 'consultor' and e_equipe_apsis()
        and (pode_tela('auditoria') or pode_tela('checagem')))
    or (origem = 'claro' and coalesce(papel_atual(), '') = 'cliente')
    or (origem = 'epo'   and e_responsavel_da_alocacao(alocacao_id))
  );

-- Quem anexou tira o proprio arquivo. Faltava a APSIS de campo: apagava-se
-- anexo da Claro e da EPO, e o do consultor so por coordenacao.
drop policy if exists alanx_del on alocacao_anexos;
create policy alanx_del on alocacao_anexos for delete to authenticated
  using (
    coalesce(papel_atual(), '') in ('admin', 'gestor')
    or (origem = 'consultor' and e_equipe_apsis())
    or (origem = 'claro' and coalesce(papel_atual(), '') = 'cliente')
    or (origem = 'epo'   and e_responsavel_da_alocacao(alocacao_id))
  );

-- ---------------------------------------------------------------------------
-- 2) O responsavel da EPO nao alcancava a unica tela dele.
--
-- A carga inicial da matriz gravou 'envio' = liberado e 'checagem' = negado
-- para o responsavel. 'envio' nao e tela de nada: nao existe no menu nem no
-- mapa de paginas, e nenhuma regra a consulta. A tela de Evidencias e
-- 'checagem'. Resultado: entrava, era desviado dela, e o anexo tambem caia.
--
-- 'config' idem: a secao Configuracoes aparece ou desaparece conforme os itens
-- dentro dela, e nao por uma linha propria. Ficavam duas chaves na tabela que
-- a matriz nem desenha - e uma delas escondia justamente a tela de quem menos
-- tem tela.
-- ---------------------------------------------------------------------------
update permissoes_papel set permitido = true
 where papel = 'responsavel' and tela = 'checagem';

delete from permissoes_papel where tela in ('envio', 'config');

alter table permissoes_papel drop constraint if exists perm_tela_chk;
alter table permissoes_papel add constraint perm_tela_chk
  check (tela in ('geral', 'epos', 'cronograma', 'ranking', 'comparativo', 'gerencial',
                  'pendentes', 'realizadas', 'auditoria', 'checagem', 'questionarios',
                  'alocacoes', 'giro', 'evidencias', 'criterios', 'acessos'));

-- Gerenciamento de acessos para a Claro: a tela abria e vinha vazia, porque o
-- servidor so mostra a lista de acessos a quem administra ou coordena a APSIS.
-- Era liberacao minha na carga inicial, nao escolha de ninguem. Fica negada -
-- e volta com um clique na matriz, se um dia fizer sentido.
update permissoes_papel set permitido = false
 where papel = 'cliente' and tela = 'acessos';

-- ---------------------------------------------------------------------------
-- 3) A Gerencia Claro entraria e nao veria nada.
--
-- Nove regras de leitura comparam o cliente da linha com o cliente de quem
-- pergunta, e aprovar data no cronograma faz a mesma conta. Esse vinculo vem
-- da liberacao de acesso, e a tela de acessos nao pergunta cliente nenhum -
-- corretamente, porque o unico cliente e a Claro. So que o campo ficava vazio:
-- o vinculo nunca se formava, as telas abririam vazias e "Aprovar data" seria
-- recusado. Agora quem entra como Gerencia Claro recebe a Claro por padrao.
-- ---------------------------------------------------------------------------
create or replace function public.acesso_cliente_padrao()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.papel = 'cliente' and new.cliente_id is null then
    select id into new.cliente_id from clientes where slug = 'claro';
  end if;
  return new;
end $$;

drop trigger if exists trg_acesso_cliente_padrao on acessos_autorizados;
create trigger trg_acesso_cliente_padrao
  before insert or update on acessos_autorizados
  for each row execute function acesso_cliente_padrao();

update acessos_autorizados
   set cliente_id = (select id from clientes where slug = 'claro')
 where papel = 'cliente' and cliente_id is null;

update perfis
   set cliente_id = (select id from clientes where slug = 'claro')
 where papel = 'cliente' and cliente_id is null;

-- ---------------------------------------------------------------------------
-- 4) "Desativar" nao desativava quem e da casa.
--
-- Conta de e-mail da APSIS entra como equipe de campo mesmo sem liberacao: e
-- assim de proposito, para quem chega pela conta Microsoft. Mas essa regra
-- passava por cima da desativacao: desativar uma pessoa da APSIS a devolvia
-- para equipe de campo no login seguinte, e ela ainda podia criar conta nova.
-- Quem coordena via o acesso marcado como inativo e a pessoa continuava
-- entrando. Decisao escrita vence padrao: linha desativada agora barra.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_papel   text;
  v_cliente uuid;
  v_email   text;
  v_aut     record;
begin
  v_email := lower(btrim(coalesce(new.email, '')));

  -- Vincula a conta aos relatorios pedidos para este e-mail.
  update alocacoes set responsavel_user = new.id
   where lower(responsavel_email) = v_email and responsavel_user is null;

  select papel, cliente_id, ativo into v_aut
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
    -- Consta na lista e esta desativada: nada de padrao por dominio.
    v_papel := 'sem_acesso';
    v_cliente := null;

  elsif v_email like '%@apsis.com.br' then
    v_papel := 'auditor';
    v_cliente := null;

  elsif exists (select 1 from alocacoes where lower(responsavel_email) = v_email) then
    v_papel := 'responsavel';
    select id into v_cliente from clientes where slug = 'claro';

  else
    -- Antes esta linha entregava o papel de gerente da Claro. Com o cadastro
    -- de contas aberto, qualquer pessoa com um e-mail valido passava a ler o
    -- cadastro inteiro de fornecedores. Agora entra e nao ve nada.
    v_papel := 'sem_acesso';
    v_cliente := null;
  end if;

  insert into perfis (user_id, nome, papel, cliente_id)
  values (new.id,
          coalesce(nullif(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
                   split_part(v_email, '@', 1)),
          v_papel, v_cliente)
  on conflict (user_id) do nothing;
  return new;
end $$;

create or replace function public.conta_nova_permitida()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text; v_ativo boolean;
begin
  v_email := lower(btrim(coalesce(new.email, '')));

  -- Conta sem e-mail nao passa por aqui: e criada por caminho interno do
  -- proprio sistema de contas, e nao ha regra nossa a aplicar.
  if v_email = '' then return new; end if;

  select ativo into v_ativo from acessos_autorizados
   where lower(btrim(email)) = v_email limit 1;

  -- 1) esta na lista de liberados e esta ativa
  if v_ativo then return new; end if;

  -- Consta na lista e esta desativada: nem pelo dominio, nem pelo pedido.
  if v_ativo is not null then
    raise exception 'Este e-mail nao tem acesso liberado. Fale com o seu contato na APSIS.'
      using errcode = '42501';
  end if;

  -- 2) e da propria casa
  if v_email like '%@apsis.com.br' then return new; end if;

  -- 3) tem relatorio pedido para este e-mail (o pedido ja e a autorizacao)
  if exists (select 1 from alocacoes
              where lower(btrim(responsavel_email)) = v_email) then
    return new;
  end if;

  -- Frase curta e sem detalhe de bastidor: ela chega na tela de entrada.
  raise exception 'Este e-mail nao tem acesso liberado. Fale com o seu contato na APSIS.'
    using errcode = '42501';
end $$;

create or replace function public.sincronizar_meu_acesso()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_papel text;
  v_aut   record;
  v_cli   uuid;
begin
  if not mfa_ok() then return null; end if;

  v_email := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  if v_email = '' then return papel_atual(); end if;

  select papel into v_papel from perfis where user_id = auth.uid();
  if coalesce(v_papel, '') = 'admin' then return v_papel; end if;

  select papel, cliente_id, ativo into v_aut
    from acessos_autorizados
   where lower(btrim(email)) = v_email
   limit 1;

  if v_aut.papel is null then return papel_atual(); end if;

  if v_aut.ativo then
    v_cli := v_aut.cliente_id;
    if v_aut.papel = 'cliente' and v_cli is null then
      select id into v_cli from clientes where slug = 'claro';
    end if;
    update perfis set papel = v_aut.papel, cliente_id = v_cli
     where user_id = auth.uid()
       and (papel is distinct from v_aut.papel
         or cliente_id is distinct from v_cli);
    update acessos_autorizados
       set primeiro_acesso_em = coalesce(primeiro_acesso_em, now())
     where lower(btrim(email)) = v_email;
  else
    -- Desativado e desativado, inclusive para e-mail da APSIS: antes esta
    -- linha devolvia 'auditor' para o dominio da casa e a desativacao virava
    -- enfeite.
    update perfis set papel = 'sem_acesso', cliente_id = null
     where user_id = auth.uid();
  end if;

  return papel_atual();
end $$;
