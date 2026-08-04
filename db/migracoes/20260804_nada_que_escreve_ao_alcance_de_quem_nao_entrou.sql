-- ===========================================================================
-- Sete funcoes ficaram executaveis pelo papel anonimo - o de quem NAO entrou no
-- sistema. Achado varrendo os privilegios de execucao funcao por funcao.
--
-- Nao foi descuido de um comando: neste projeto toda funcao nova nasce com
-- execucao concedida a anon e authenticated (e a configuracao de privilegio
-- padrao do schema publico). "revoke from public" nao tira essas duas, porque sao
-- concessoes proprias, e nao a de PUBLIC. Nos gatilhos, a concessao vinha de
-- PUBLIC, e tirar de anon nao tira o que ele herda de PUBLIC.
--
-- Cinco delas se defendiam sozinhas (papel_atual/pode_tela devolvem nulo sem
-- sessao e a funcao recusa). Uma era caminho de escrita SEM porteiro:
-- epo_responsaveis_da_planilha grava responsavel em qualquer unidade e nao tem
-- portao proprio, porque e ajudante interna das duas importacoes.
--
-- Regra que fica: quem escreve nao e alcancavel por quem nao entrou, e ajudante
-- interna nem por quem entrou - as chamadoras sao SECURITY DEFINER e chamam como
-- donas da tabela.
--
-- Conferido depois: nenhuma funcao do schema publico responde a anon.
-- ===========================================================================
revoke execute on function public.epo_responsaveis_da_planilha(uuid, text, text) from anon, authenticated;
revoke execute on function public.epos_importar(text, jsonb, text[]) from anon;
revoke execute on function public.cronograma_importar(text, jsonb, text[], text) from anon;
revoke execute on function public.pergunta_apagar(uuid) from anon;
revoke execute on function public.questionario_apagar(uuid) from anon;

revoke execute on function public.registrar_edicao_auditoria() from public;
revoke execute on function public.registrar_edicao_resposta() from public;
revoke execute on function public.acesso_cliente_padrao() from public;
revoke execute on function public.permissoes_touch() from public;
revoke execute on function public.cronograma_touch() from public;

grant execute on function public.epos_importar(text, jsonb, text[]) to authenticated;
grant execute on function public.cronograma_importar(text, jsonb, text[], text) to authenticated;
