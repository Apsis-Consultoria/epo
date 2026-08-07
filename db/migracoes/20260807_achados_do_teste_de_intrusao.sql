-- Achados do teste de intrusao, do fuzzing e da varredura de CVE (07/08/2026).
--
-- O que esta rodada NAO encontrou, e vale registrar porque foi medido e nao
-- suposto:
--
--   - fuzzing das duas funcoes publicas de entrada com ~25 cargas hostis (JSON
--     malformado, corpo vazio, array no lugar de objeto, e-mail como objeto,
--     array, numero, booleano e operador NoSQL, curinga LIKE, aspas SQL, CRLF,
--     XSS, byte nulo, 100 mil caracteres): nenhum erro 500, nenhuma mensagem
--     interna, resposta 400 uniforme. Confirmado tambem pelo log das funcoes;
--   - so com a chave publicavel, toda funcao que exige sessao respondeu 401, a
--     tarefa de avisos 403 e as duas cascas 410;
--   - escalonamento de papel: nem 'cliente' nem 'responsavel' escrevem em
--     permissoes_papel ou acessos_autorizados, nem alteram o proprio perfil;
--   - vazamento entre unidades concorrentes: com o auditor sendo a APSIS (o
--     cenario real), o responsavel de uma unidade le 0 auditorias, 0 respostas e
--     0 evidencias da concorrente. As duas politicas que de fato vazavam
--     (indicadores_reversa e cronograma_importacoes) foram fechadas na migracao
--     anterior desta data.
--
-- CVE conferidos por versao exata:
--   - supabase-js 2.45.4: CVE-2025-48370 (auth-js) afeta por numero, mas as
--     cinco funcoes vulneraveis sao do namespace auth.admin e nenhuma e chamada
--     por este sistema. Sem exposicao pratica; atualizar e higiene, nao urgencia;
--   - leaflet 1.9.4: CVE-2025-69993 (XSS via bindPopup) existe, e NAO e
--     alcancavel: o unico bindPopup (assets/mapa-epos.js) escapa todo campo;
--   - SheetJS 0.20.3: acima do corte de CVE-2023-30533 e CVE-2024-22363;
--   - chart.js 4.4.1 e tabler-icons 3.11.0: sem CVE conhecido;
--   - GoTrue v2.195.0: acima da 2.185.0 que corrigiu o CVE-2026-31813 (bypass
--     de emissor OIDC com provider Azure, que este sistema usa). Ja protegido;
--   - PostgreSQL 17.6: CVE-2026-2005 (heap overflow no pgcrypto, CVSS 8.8,
--     corrigido na 17.8) afeta esta versao POR NUMERO. Nao e alcancavel daqui:
--     as funcoes pgp_* vivem no schema extensions, que o PostgREST nao expoe
--     (medido: devolve "Only the following schemas are exposed: public,
--     graphql_public"), e nenhuma funcao do sistema as chama. Explorar exige
--     execucao de SQL arbitrario, que o fuzzing nao encontrou. A correcao e
--     subir a versao do Postgres no painel do projeto.

-- ===========================================================================
-- A UNICA FALHA NOVA: A TRAVA DO DOMINIO DA CASA FALTAVA NUMA DAS DUAS PORTAS
--
-- Estar em epo_responsaveis OU em alocacoes.responsavel_email vale como acesso
-- liberado: enviar-codigo-entrada manda o codigo, e handle_new_user da o papel
-- 'responsavel'. Sao duas portas para a mesma sala.
--
-- Na rodada anterior eu fechei so a primeira: epo_resp_ins passou a recusar
-- endereco @apsis.com.br vindo de quem nao e admin nem gestor. A porta de
-- alocacoes ficou aberta, e o teste confirmou: o papel cliente criou um pedido
-- no nome de invasor@apsis.com.br sem nenhuma recusa.
--
-- O ganho de quem explorava era limitado (o papel concedido por esse caminho e
-- 'responsavel', preso a unidade, e nao administracao), mas duas portas para a
-- mesma sala precisam da mesma fechadura - senao a proxima leitura do codigo
-- conclui que a regra existe, quando ela so existe em metade dos casos.
--
-- Provado nos tres sentidos: cliente com @apsis recusado, cliente com endereco
-- comum aceito (o fluxo legitimo do produto, que e o gerente da Claro pedindo o
-- checklist ao fornecedor), e admin liberado.
drop policy if exists aloc_ins on public.alocacoes;
create policy aloc_ins on public.alocacoes for insert to authenticated
  with check (
    (pode_tela('epos') or pode_tela('alocacoes'))
    and exists (select 1 from epos e where e.id = epo_id)
    and (coalesce(papel_atual(), '') in ('admin', 'gestor')
         or lower(btrim(coalesce(responsavel_email, ''))) not like '%@apsis.com.br')
  );

-- ===========================================================================
-- MENSAGEM CRUA DE ERRO EM convidar-responsavel (fechado na funcao, nao aqui)
--
-- Mesma classe que ja tinha sido fechada em sincronizar-sharepoint: tres
-- respostas devolviam o texto interno ao chamador - duas do Postgres ("falha ao
-- ler a liberacao: " + error.message, e a do relatorio pedido) e uma do servico
-- de contas. O texto do Postgres nomeia tabela, coluna e politica; basta mandar
-- um id fora do formato de UUID para provoca-lo. Agora o detalhe vai para o log
-- da funcao e quem chamou recebe a frase.
