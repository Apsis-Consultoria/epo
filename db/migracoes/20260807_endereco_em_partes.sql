-- O endereco da unidade em partes, e o CEP preenchendo o que ele sabe.
--
-- Havia um campo unico, "Endereco", com a instrucao "rua, numero, complemento".
-- O CEP tentava preencher, mas so escrevia quando o campo estava VAZIO - senao
-- apagaria o numero e o complemento que a pessoa tinha digitado, que sao
-- justamente as duas coisas que o CEP nao sabe.
--
-- O efeito: em unidade ja cadastrada o CEP nunca preenchia nada, porque o campo
-- nunca estava vazio. Parecia que a busca por CEP nao funcionava.
--
-- Separando as partes, cada uma tem um dono claro:
--   logradouro, bairro, cidade, uf  -> vem do CEP, e o CEP pode reescrever
--   numero, complemento             -> so a pessoa preenche, e nada os toca
--
-- endereco CONTINUA existindo e continua sendo o endereco completo: e ele que o
-- mapa, o e-mail da visita, a planilha e a tela de detalhe leem. Passa a ser
-- montado a partir das partes na hora de gravar, em vez de digitado.

alter table public.epos add column if not exists logradouro  text;
alter table public.epos add column if not exists numero      text;
alter table public.epos add column if not exists complemento text;
alter table public.epos add column if not exists bairro      text;

comment on column public.epos.logradouro  is 'Rua/avenida. Vem do CEP.';
comment on column public.epos.numero      is 'So a pessoa preenche: o CEP nao sabe o numero.';
comment on column public.epos.complemento is 'So a pessoa preenche: sala, bloco, galpao.';
comment on column public.epos.bairro      is 'Vem do CEP.';
comment on column public.epos.endereco    is
  'Endereco completo, montado a partir das partes. E o que o mapa e os e-mails leem.';

-- ===========================================================================
-- O QUE JA ESTA GRAVADO
--
-- Unidade antiga tem so o campo unico preenchido, e nao da para saber onde
-- termina a rua e comeca o numero sem chutar. Chutar aqui erraria endereco de
-- unidade que a equipe usa para chegar la.
--
-- Entao o campo unico inteiro vai para logradouro, e numero e complemento
-- nascem vazios. Na primeira vez que alguem abrir a unidade, o CEP reescreve o
-- logradouro certo e sobra preencher o numero - que e o passo que se queria.
update epos
   set logradouro = endereco
 where logradouro is null
   and coalesce(btrim(endereco), '') <> '';
