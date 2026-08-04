-- Detalhe da EPO passa a ter chave propria na matriz de acessos.
--
-- Ate aqui a tela epo-detalhe era guardada pela permissao de "ranking": quem
-- montava a matriz na tela de acessos nao via essa tela em lugar nenhum, e ela
-- se alcanca clicando numa unidade na visao geral, no ranking ou no mapa.
--
-- A matriz da tela de acessos era montada a partir da lista do MENU LATERAL.
-- Tela que existe e nao esta no menu ficava fora do controle. Agora a lista
-- canonica das telas fica em assets/data.js (telasSistema), o guard usa a mesma
-- chave (MAPA_PAGINAS em assets/auth.js) e esta regra aceita as 16.
alter table permissoes_papel drop constraint perm_tela_chk;
alter table permissoes_papel add constraint perm_tela_chk check (tela = any (array[
  'geral', 'epos', 'cronograma', 'ranking', 'detalhe', 'comparativo', 'gerencial',
  'pendentes', 'realizadas', 'auditoria', 'checagem', 'questionarios',
  'alocacoes', 'giro', 'evidencias', 'acessos'
]));

-- Comeca igual ao que valia antes, para ninguem ganhar nem perder acesso na
-- virada: quem alcancava o ranking alcancava o detalhe.
insert into permissoes_papel (papel, tela, permitido)
select papel, 'detalhe', permitido from permissoes_papel where tela = 'ranking'
on conflict (papel, tela) do nothing;
