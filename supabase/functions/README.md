# Edge Functions

Copia versionada do que esta publicado no projeto Supabase. Publicar de novo
depois de editar (pelo painel, pela CLI ou pelo assistente).

- `convidar-responsavel` - avisa por e-mail o responsavel da EPO que ha
  relatorio para enviar. Conta nova recebe convite; conta existente recebe um
  novo codigo de acesso. O link nunca volta na resposta.
- `sincronizar-sharepoint` - encaminha para a pasta oficial os arquivos que
  ainda nao subiram e grava a url de volta na linha.

## sincronizar-sharepoint

Destino padrao (ja no codigo, sem precisar de segredo):

    apsisconsult.sharepoint.com/sites/backoffice_s > biblioteca PI
      > Projeto Claro (pasta teste)

Dentro dela, cada arquivo cai em:

    Projeto Claro (pasta teste)/EPO/ano-mes/questionario/origem/arquivo

`origem` e `Comprovacoes da EPO` (anexos do responsavel) ou `Vistoria APSIS`
(evidencias do consultor).

Como e chamada, sempre com o JWT de quem esta logado:

| Corpo | O que faz | Quem pode |
|---|---|---|
| `{ alocacao_id }` | anexos daquele relatorio | quem enxerga a alocacao |
| `{ auditoria_id }` | evidencias daquela vistoria | quem enxerga a auditoria |
| `{ tudo: true }` | reenvia tudo que ficou para tras | admin e gestor |
| `{ teste: true }` | confere credenciais e destino, sem subir nada | admin e gestor |

O app chama sozinho: `envio.html` ao anexar e ao concluir o envio,
`auditoria.html` ao enviar a vistoria. Arquivo que falha fica marcado como erro
e **entra de novo na proxima chamada**, ou seja: corrigir a permissao no Azure e
chamar `{ tudo: true }` recupera tudo, sem refazer envio nenhum.

Cada chamada sobe no maximo 100 arquivos e para sozinha antes do limite de tempo
da plataforma. Se `lote_cheio` voltar `true`, chamar de novo para pegar o resto:
arquivo adiado continua pendente, nada se perde no meio do caminho.

## Segredos (Edge Functions > Secrets)

Obrigatorios:

| Nome | Para que serve |
|---|---|
| `AZURE_TENANT_ID` | tenant da APSIS no Azure (Entra ID) |
| `AZURE_CLIENT_ID` | app registrado no Azure |
| `AZURE_CLIENT_SECRET` | segredo desse app |

Tambem servem, para o mesmo fim, `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID` e
`GRAPH_CLIENT_SECRET` (nomes do primeiro rascunho).

Opcionais, so para trocar a pasta de destino sem publicar codigo novo:

| Nome | Alternativa | Padrao no codigo |
|---|---|---|
| `AZURE_SHAREPOINT_HOSTNAME` | `SP_HOSTNAME` | `apsisconsult.sharepoint.com` |
| `AZURE_SHAREPOINT_SITE` | `SP_SITE_PATH` | `/sites/backoffice_s` |
| `AZURE_SHAREPOINT_BIBLIOTECA` | `SP_BIBLIOTECA` | `PI` |
| `AZURE_SHAREPOINT_PASTA` | `SP_PASTA_RAIZ` | `Projeto Claro (pasta teste)` |

O app do Azure precisa de permissao **de aplicacao** do Microsoft Graph com
consentimento do administrador (`Sites.Selected`, autorizando o site, ou
`Sites.ReadWrite.All`). Sem isso o token e emitido mas o Graph responde 403.

## Conferir a configuracao sem subir arquivo

Logado no sistema como admin ou gestor, no console do navegador:

    Auth.cliente.functions
      .invoke('sincronizar-sharepoint', { body: { teste: true } })
      .then(function (r) { console.log(r.data || r.error); });

Resposta esperada:

    { ok: true, site: 'backoffice_s', biblioteca: 'PI',
      pasta: 'Projeto Claro (pasta teste)', pasta_id: '...',
      pasta_url: 'https://apsisconsult.sharepoint.com/...',
      segredos: { tenant: 'AZURE_TENANT_ID', client_id: '...', secret: '...' } }

`segredos` mostra **apenas o nome** do segredo que a funcao encontrou, nunca o
valor: serve para descobrir na hora se algum foi cadastrado com outro nome.
`pasta_url` abre a pasta ja criada.

Quando falta credencial, a resposta traz `configurado: false` e `faltando` com
os nomes aceitos.

## Empurrar o que ficou para tras

    Auth.cliente.functions
      .invoke('sincronizar-sharepoint', { body: { tudo: true } })
      .then(function (r) { console.log(r.data || r.error); });
