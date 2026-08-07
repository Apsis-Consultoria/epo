-- A gerencia da Claro passa a liberar acesso.
--
-- Ate aqui so administracao e coordenacao da APSIS liberavam acesso, e a
-- gerencia da Claro tinha de pedir para cada pessoa da equipe dela. Passa a
-- liberar sozinha - com um limite que nao e detalhe:
--
--   ela NAO cria equipe de campo.
--
-- Quem preenche a auditoria e a APSIS. A Claro e a contratante, a parte
-- interessada no resultado. Se a contratante pudesse criar quem audita, a
-- separacao entre quem avalia e quem e avaliado deixaria de existir, e o
-- resultado perderia valor como evidencia. Administracao e coordenacao ficam
-- fora pelo mesmo motivo de sempre: quem administra o sistema e escolha de quem
-- responde por ele.
--
-- A tela ja mostra esses papeis travados. Isto aqui e o servidor recusando o
-- mesmo, para o caso de o pedido nao vir da tela.

-- ===========================================================================
-- 1) A REGRA, EM UM LUGAR SO
--
-- Politica e gatilho leem a mesma funcao. Regra escrita duas vezes e regra que
-- em algum momento discorda de si mesma.
create or replace function public.papel_liberavel_por(quem text, alvo text)
returns boolean language sql immutable as $function$
  select case coalesce(quem, '')
    when 'admin'   then alvo in ('admin', 'gestor', 'auditor', 'cliente', 'responsavel')
    when 'gestor'  then alvo in ('auditor', 'cliente', 'responsavel')
    when 'cliente' then alvo in ('cliente', 'responsavel')
    else false
  end;
$function$;

comment on function public.papel_liberavel_por(text, text) is
  'Que papel cada papel pode liberar. Gerencia do cliente nao cria equipe de campo.';

revoke all on function public.papel_liberavel_por(text, text) from public, anon;
grant execute on function public.papel_liberavel_por(text, text) to authenticated;

-- ===========================================================================
-- 2) O QUE A GERENCIA DO CLIENTE ALCANCA NA TABELA
--
-- Politicas novas, ao lado das que ja existem - e nao no lugar delas. Politica
-- permissiva soma: acrescentar alarga sem mexer no que ja estava provado.
--
-- Apagar continua de fora: apagar acesso nao tem volta e fica com quem
-- administra. Desativar resolve o caso do dia a dia e deixa rastro.
drop policy if exists acessos_gerencia_cliente_ins on public.acessos_autorizados;
create policy acessos_gerencia_cliente_ins on public.acessos_autorizados
  for insert to authenticated
  with check (
    coalesce(papel_atual(), '') = 'cliente'
    and pode_tela('acessos')
    and papel_liberavel_por('cliente', papel)
    -- Nao libera gente para outro cliente que nao o dela.
    and coalesce(cliente_id, cliente_atual()) = cliente_atual()
  );

-- using fala da linha como esta hoje; with check, de como ela ficaria. Os dois
-- precisam passar: sem o using, dava para pegar uma linha de auditor e
-- rebaixa-la; sem o with check, dava para promover a propria linha a auditor.
drop policy if exists acessos_gerencia_cliente_upd on public.acessos_autorizados;
create policy acessos_gerencia_cliente_upd on public.acessos_autorizados
  for update to authenticated
  using (
    coalesce(papel_atual(), '') = 'cliente'
    and pode_tela('acessos')
    and papel_liberavel_por('cliente', papel)
  )
  with check (
    coalesce(papel_atual(), '') = 'cliente'
    and pode_tela('acessos')
    and papel_liberavel_por('cliente', papel)
    and coalesce(cliente_id, cliente_atual()) = cliente_atual()
  );

-- ===========================================================================
-- 3) A MESMA REGRA UM PASSO ADIANTE
--
-- Gatilho proprio, e nao alteracao do normalizador que ja existe: aquele arruma
-- e-mail e cliente, e mexer as cegas no que esta certo e como se quebra o que
-- estava funcionando.
--
-- Serve para o caso de alguem alcancar a tabela por um caminho que nao passe
-- pelas politicas. papel_atual() vazio e o servidor falando com a propria
-- chave (as funcoes de convite): esse caminho continua liberado.
create or replace function public.acessos_limite_de_quem_libera()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_quem text;
begin
  v_quem := coalesce(papel_atual(), '');
  if v_quem = '' or v_quem = 'admin' then return new; end if;

  if not papel_liberavel_por(v_quem, new.papel) then
    raise exception 'este acesso nao pode ser liberado por quem esta pedindo';
  end if;
  return new;
end $function$;

drop trigger if exists tg_acessos_limite_de_quem_libera on public.acessos_autorizados;
create trigger tg_acessos_limite_de_quem_libera
  before insert or update of papel on public.acessos_autorizados
  for each row execute function public.acessos_limite_de_quem_libera();

-- ===========================================================================
-- 4) A LISTA DE CONTAS, COM O E-MAIL
--
-- A tela de acessos mostrava duas listas que pareciam a mesma coisa: quem foi
-- liberado (acessos_autorizados) e quem tem conta (perfis). Nao dava para
-- cruzar as duas, porque perfis nao guarda e-mail - e sem cruzar, a mesma
-- pessoa aparecia duas vezes e a segunda lista nao dizia nada de novo.
--
-- Esta visao junta o e-mail da conta. Com ele, a tela separa o que interessa:
-- conta que existe e NAO tem acesso liberado. E so isso que a segunda lista
-- tem de mostrar.
--
-- security_invoker nao serve aqui: auth.users nao esta ao alcance de quem usa o
-- sistema. Entao a visao decide o alcance dentro dela: quem nao alcanca a tela
-- de acessos nao le nada.
create or replace view public.contas_do_sistema as
  select p.user_id,
         p.nome,
         p.papel,
         lower(btrim(u.email)) as email,
         u.last_sign_in_at
    from perfis p
    join auth.users u on u.id = p.user_id
   where pode_tela('acessos');

comment on view public.contas_do_sistema is
  'Contas que existem, para a tela de acessos. So enxerga quem alcanca a tela.';

-- O Supabase concede leitura ao anon em toda visao nova. Sem este revoke, a
-- lista de contas do sistema ficava aberta a quem nem entrou.
revoke all on public.contas_do_sistema from public, anon;
grant select on public.contas_do_sistema to authenticated;
