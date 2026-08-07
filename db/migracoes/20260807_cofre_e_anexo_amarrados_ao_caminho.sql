-- Achados da segunda passada do fuzzing e da varredura de superficie (07/08/2026).
--
-- A primeira passada de tres frentes voltou degenerada (resumo "teste", achado de
-- titulo "a") e foi refeita com exigencia minima de tamanho em cada campo. A
-- refeita achou o que a primeira nao achou, e o mais grave estava na ESCRITA do
-- cofre de arquivos: eu tinha corrigido a leitura pelo caminho horas antes e
-- deixado a escrita como estava. Meia correcao.
--
-- Provado ao vivo com sessao de responsavel de uma unidade, antes de corrigir:
--   1. escreveu em auditorias/<vistoria de OUTRA unidade>/... ;
--   2. escreveu num prefixo inventado;
--   3. gravou linha de anexo apontando para a foto da vistoria da APSIS, com
--      sharepoint_status 'enviado' e sharepoint_url inventada.
-- Depois de corrigir, os quatro ataques recusados e o envio legitimo intacto.

-- ===========================================================================
-- 1) ESCREVER NO COFRE SO NA PASTA QUE A PESSOA RESPONDE
--
-- ev_storage_ins era: bucket = 'evidencias' e papel em (admin, gestor, auditor,
-- cliente, responsavel). Nenhuma condicao sobre o nome do objeto. O bucket
-- tambem esta sem limite de tamanho e sem lista de tipos, e o unico controle de
-- tipo era o atributo accept do seletor de arquivo, que e dica de janela e nao
-- barreira.
--
-- Agora cada prefixo tem dono, com o mesmo criterio da tabela correspondente. Os
-- exists correm sob a RLS de quem chama, entao o recorte por contratante vem de
-- graca.
drop policy if exists ev_storage_ins on storage.objects;
create policy ev_storage_ins on storage.objects for insert to authenticated
with check (
  bucket_id = 'evidencias'
  and (
    (name like 'auditorias/%' and pode_editar_auditoria(id_do_caminho(name, 2)))
    or (name like 'alocacoes/%'
        and (e_equipe_apsis()
             or coalesce(papel_atual(), '') = 'cliente'
             or e_responsavel_da_alocacao(id_do_caminho(name, 2)))
        and exists (select 1 from alocacoes a where a.id = id_do_caminho(name, 2)))
    or (name like 'contagens/%' and pode_editar_contagem(id_do_caminho(name, 2)))
  )
);

-- ===========================================================================
-- 2) A LINHA DO ANEXO APONTA PARA A PROPRIA PASTA, E NASCE SEM SELO DE ENVIADO
--
-- alanx_ins conferia que a alocacao e o item existem e que o papel combina com a
-- origem, mas nada sobre storage_path, que e texto livre. Aceitar 'enviado' no
-- insert deixava a auditada marcar como encaminhado a pasta oficial um arquivo
-- que nunca foi, com um endereco inventado ao lado.
--
-- O caminho exigido e exatamente o que a tela grava (checagem.html:1018).
drop policy if exists alanx_ins on public.alocacao_anexos;
create policy alanx_ins on public.alocacao_anexos for insert to authenticated
  with check (
    exists (select 1 from alocacoes a where a.id = alocacao_id)
    and exists (select 1 from itens_checklist i where i.id = item_id)
    and storage_path like 'alocacoes/' || alocacao_id::text || '/%'
    and coalesce(sharepoint_status, 'pendente') = 'pendente'
    and sharepoint_url is null
    and (
      (origem = 'consultor' and e_equipe_apsis()
       and (pode_tela('auditoria') or pode_tela('checagem')))
      or (origem = 'claro' and coalesce(papel_atual(), '') in ('cliente', 'admin'))
      or (origem = 'epo'   and e_responsavel_da_alocacao(alocacao_id))
    )
  );

-- ===========================================================================
-- 3) ANEXO DE PEDIDO JA ENVIADO SO SAI PELA COORDENACAO
--
-- alanx_del liberava a exclusao por origem 'epo' sem olhar a situacao do pedido,
-- e nao existe gatilho de historico em alocacao_anexos: a linha e o arquivo
-- sumiam juntos e nada registrava. Enquanto o pedido esta aberto, trocar um anexo
-- errado e parte do trabalho; depois de enviado, ele e prova.
drop policy if exists alanx_del on public.alocacao_anexos;
create policy alanx_del on public.alocacao_anexos for delete to authenticated
  using (
    exists (select 1 from alocacoes a where a.id = alocacao_id)
    and (
      coalesce(papel_atual(), '') in ('admin', 'gestor')
      or (origem = 'consultor' and e_equipe_apsis())
      or (origem = 'claro' and coalesce(papel_atual(), '') = 'cliente')
      or (origem = 'epo' and e_responsavel_da_alocacao(alocacao_id)
          and exists (select 1 from alocacoes a
                       where a.id = alocacao_id and coalesce(a.status, '') <> 'enviada'))
    )
  );

drop policy if exists ev_storage_del on storage.objects;
create policy ev_storage_del on storage.objects for delete to authenticated
using (
  bucket_id = 'evidencias'
  and (
    coalesce(papel_atual(), '') in ('admin', 'gestor')
    or (owner = auth.uid() and (
          (name like 'auditorias/%'
           and exists (select 1 from auditorias a
                        where a.id = id_do_caminho(name, 2) and a.status = 'rascunho'))
          or (name like 'alocacoes/%'
              and exists (select 1 from alocacoes a
                           where a.id = id_do_caminho(name, 2)
                             and coalesce(a.status, '') <> 'enviada'))
          or (name like 'contagens/%' and pode_editar_contagem(id_do_caminho(name, 2)))
        ))
  )
);

-- ===========================================================================
-- 4) O RECORTE POR CONTRATANTE FALTAVA NO ANEXO E NO PEDIDO
--
-- alanx_sel e aloc_sel liberavam o papel 'cliente' sem filtrar por
-- cliente_atual(), diferente de aud_sel e cg_sel nas tabelas vizinhas, que
-- filtram. Hoje ha um contratante so, entao nao houve vazamento; com o segundo, a
-- gerencia de um leria o anexo do outro.
drop policy if exists alanx_sel on public.alocacao_anexos;
create policy alanx_sel on public.alocacao_anexos for select to authenticated
  using (
    e_equipe_apsis()
    or e_responsavel_da_alocacao(alocacao_id)
    or (coalesce(papel_atual(), '') = 'cliente'
        and exists (select 1 from alocacoes a join epos e on e.id = a.epo_id
                     where a.id = alocacao_id and e.cliente_id = cliente_atual()))
  );

drop policy if exists aloc_sel on public.alocacoes;
create policy aloc_sel on public.alocacoes for select to authenticated
  using (
    e_equipe_apsis()
    or e_responsavel_da_alocacao(id)
    or (coalesce(papel_atual(), '') = 'cliente'
        and exists (select 1 from epos e where e.id = epo_id and e.cliente_id = cliente_atual()))
  );

-- ===========================================================================
-- 5) A CHAMADA HTTP DE DENTRO DO BANCO SAI DO ALCANCE DE QUEM ENTRA PELA API
--
-- net.http_post e net.http_get continuavam com EXECUTE para anon e authenticated.
-- Nao havia exposicao (o schema net nao e publicado pelo PostgREST e a unica
-- funcao que chama monta a URL literal), mas quem faz chamada de rede a partir do
-- banco e a tarefa agendada, e mais ninguem.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as assinatura
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'net'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.assinatura);
  end loop;
end $$;

-- ===========================================================================
-- O QUE FOI CORRIGIDO NAS TELAS NA MESMA RODADA (fora do banco)
--
-- - O arquivo do cofre passa a ser assinado com download nas tres telas que o
--   exibem. O tipo gravado no objeto e o que quem enviou declarou: um .svg
--   enviado como image/svg+xml era SERVIDO como documento, e SVG executa script -
--   clicar no anexo rodava o script na origem do site, com a sessao de quem
--   clicou. Com download, o servidor responde "anexo". A miniatura continua com o
--   endereco cru, porque <img> nunca executa script.
-- - A perspectiva "Ver como" passou a aceitar SO auditor e responsavel. Antes
--   aceitava qualquer chave de papeisPreset, inclusive 'admin', e
--   permissoesDe('admin') devolve todas as telas antes de olhar a matriz: um
--   gestor restringido desfazia a propria restricao com uma linha no console.
-- - A matriz de telas passou a distinguir "nao chegou" de "chegou vazia". Antes
--   as duas caiam no padrao escrito no codigo, e o padrao do papel cliente traz a
--   tela de Gerenciamento de acessos como permitida - bloquear a chamada no
--   painel do navegador recuperava o editor de cargos.
-- - O modo demonstracao (sessionStorage.epoDemo), que passa ao largo do guard
--   inteiro inclusive do segundo fator, so liga em localhost.
-- - A segunda funcao de escape da tela de entrada passou a cobrir apostrofo e
--   crase, como App.escapeHtml.
-- - A exportacao para planilha prefixa celula que comeca com = + @, porque boa
--   parte do que sai ali e nome de arquivo escolhido pela unidade auditada e
--   viraria formula na maquina de quem abre.
