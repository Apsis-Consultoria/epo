-- ===========================================================================
-- Entrada por codigo no e-mail, sem senha.
--
-- A Gerencia Claro e o responsavel da EPO deixam de ter senha: na tela de
-- entrada informam o e-mail, recebem um codigo de seis digitos e digitam. Nao ha
-- mais senha para criar, guardar, esquecer nem redefinir - e a APSIS continua
-- entrando pela conta Microsoft.
--
-- Por que e melhor que o link de definir senha que existia antes: aquele link era
-- uma credencial dentro de uma caixa de e-mail, valida por horas. O codigo vale
-- dez minutos, serve uma vez, e e pedido no momento de entrar por quem esta
-- entrando.
--
-- O codigo NUNCA e guardado em claro: fica so o resumo criptografico, do mesmo
-- jeito que o codigo do segundo fator. Quem gera, guarda e envia e a funcao de
-- servidor (enviar-codigo-entrada); quem confere e devolve a credencial de uso
-- unico e a outra (confirmar-codigo-entrada). A tela nunca sabe o codigo.
-- ===========================================================================
create table if not exists public.codigos_entrada (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  codigo_hash text not null,
  enviado_em  timestamptz not null default now(),
  expira_em   timestamptz not null,
  tentativas  int not null default 0,
  usado_em    timestamptz
);

create index if not exists cod_entrada_email_idx
  on public.codigos_entrada (lower(btrim(email)), enviado_em desc);

comment on table public.codigos_entrada is
  'Codigo de entrada por e-mail (sem senha). Guarda o resumo, nunca o codigo.';

alter table public.codigos_entrada enable row level security;
-- Nenhuma politica de proposito: ninguem le nem escreve direto. So as funcoes
-- abaixo tocam nesta tabela, e elas rodam como donas.

-- codigo_entrada_registrar: guarda o resumo do codigo. Um pedido por minuto por
-- e-mail (sem freio, este endereco vira uma forma de encher a caixa de alguem), e
-- codigo novo invalida os anteriores (dois codigos validos ao mesmo tempo dobram
-- a chance de acerto de quem tenta adivinhar).
--
-- codigo_entrada_conferir: cinco tentativas por codigo; errar cinco vezes queima
-- o codigo, para nao dar para adivinhar seis digitos por tentativa.
--
-- As duas so respondem a credencial de servico: deixar ao alcance da tela seria
-- deixar a tela saber o codigo.
--
-- (corpo das funcoes aplicado na migracao entrada_por_codigo_no_email_sem_senha)

-- mfa_dispensada ganhou um terceiro caminho: sessao que nasceu de um codigo
-- enviado por e-mail nao pede um segundo codigo. Pedir de novo seria pedir a
-- mesma prova duas vezes, com dois e-mails para a mesma pessoa. O cracha da
-- sessao diz como ela nasceu ("amr" com metodo otp).
