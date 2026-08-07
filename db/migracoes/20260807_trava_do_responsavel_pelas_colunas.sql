-- Gravar responsavel de unidade devolvia 400.
--
-- O formulario manda "se ja existir a mesma pessoa nesta unidade, atualize em
-- vez de duplicar", e identifica a mesma pessoa por (epo_id, email). A trava
-- de duplicidade no banco, porem, era por (epo_id, lower(btrim(email))):
--
--   CREATE UNIQUE INDEX epo_resp_uk ON epo_responsaveis (epo_id, lower(btrim(email)))
--
-- Para o Postgres as duas coisas nao sao a mesma. Ele nao acha a trava que o
-- pedido cita e recusa com 42P10 ("there is no unique or exclusion constraint
-- matching the ON CONFLICT specification"), que chega na tela como 400.
--
-- Efeito: a lista de responsaveis NAO era gravada. O formulario nao derruba o
-- cadastro quando este passo falha - a unidade salva e sai um aviso -, entao
-- parecia ter funcionado, ainda mais porque o e-mail do responsavel principal
-- fica gravado na propria unidade e esse sim entrava.
--
-- A trava com lower(btrim(...)) existia para "Joao@x.com" e "joao@x.com " nao
-- virarem duas pessoas. Isso continua garantido, e por um caminho melhor: o
-- gatilho tg_email_em_minusculas ja normaliza o e-mail ANTES de gravar, em toda
-- insercao e alteracao. Com o valor sempre normalizado, a trava pelas colunas
-- cruas protege exatamente o mesmo - e pode ser citada por nome no pedido, que
-- e o que a expressao nao permitia.

-- Cinto e suspensorio: se alguma linha antiga escapou do gatilho, normaliza
-- antes de criar a trava. Sem isto, um e-mail com maiuscula derrubaria a
-- criacao do indice e a migracao inteira.
update public.epo_responsaveis
   set email = lower(btrim(email))
 where email is distinct from lower(btrim(email));

-- Duas linhas iguais depois de normalizar impediriam o indice unico. Fica a
-- mais antiga, que e a que tem historico; a copia sai.
delete from public.epo_responsaveis a
 using public.epo_responsaveis b
 where a.epo_id = b.epo_id
   and lower(btrim(a.email)) = lower(btrim(b.email))
   and a.criado_em > b.criado_em;

create unique index if not exists epo_resp_uk_colunas
  on public.epo_responsaveis (epo_id, email);

comment on index public.epo_resp_uk_colunas is
  'Um responsavel por e-mail em cada unidade. Pelas colunas cruas, e nao por expressao, para o upsert do formulario poder cita-la. O e-mail ja chega normalizado pelo gatilho.';

-- A trava antiga sai: com o e-mail sempre normalizado ela protege o mesmo que a
-- nova, e duas travas iguais so custam escrita em toda gravacao.
drop index if exists public.epo_resp_uk;
