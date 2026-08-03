// O envio pelo Microsoft Graph, escrito uma vez.
//
// Estava copiado nas duas funcoes que mandam e-mail. Ao reescrever o corpo do
// e-mail de acesso eu apaguei a copia de la sem perceber, e a funcao passou a
// chamar algo que nao existia mais: respondia 500, e resposta de erro da
// plataforma nao leva cabecalho de CORS, entao na tela aparecia como se fosse
// bloqueio de origem. Duas copias da mesma coisa foi o que permitiu o engano.
//
// Usa o mesmo app do Azure que leva os arquivos para a pasta oficial. Precisa
// da permissao de aplicacao Mail.Send com consentimento do administrador e do
// segredo AZURE_REMETENTE com a caixa que assina a mensagem.
const GRAPH = "https://graph.microsoft.com/v1.0";

function segredo(nomes: string[]) {
  for (const nome of nomes) {
    const valor = (Deno.env.get(nome) || "").trim();
    if (valor) return valor;
  }
  return "";
}

const TENANT = segredo(["AZURE_TENANT_ID", "GRAPH_TENANT_ID"]);
const CLIENT_ID = segredo(["AZURE_CLIENT_ID", "GRAPH_CLIENT_ID"]);
const CLIENT_SECRET = segredo(["AZURE_CLIENT_SECRET", "GRAPH_CLIENT_SECRET"]);
const REMETENTE = segredo(["AZURE_REMETENTE", "GRAPH_REMETENTE"]);

export async function tokenAzure() {
  const corpo = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials"
  });
  const r = await fetch("https://login.microsoftonline.com/" + TENANT + "/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: corpo.toString()
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) {
    throw new Error("credenciais recusadas pela Microsoft: " +
      (j.error_description || j.error || r.status));
  }
  return j.access_token as string;
}

export async function enviarPeloGraph(para: string, assunto: string, html: string) {
  if (!TENANT || !CLIENT_ID || !CLIENT_SECRET) {
    return { ok: false, motivo: "credenciais do Azure nao configuradas" };
  }
  if (!REMETENTE) {
    return { ok: false, motivo: "falta o segredo AZURE_REMETENTE com a caixa que envia" };
  }
  try {
    const token = await tokenAzure();
    const r = await fetch(GRAPH + "/users/" + encodeURIComponent(REMETENTE) + "/sendMail", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: assunto,
          body: { contentType: "HTML", content: html },
          toRecipients: [{ emailAddress: { address: para } }]
        },
        saveToSentItems: false
      })
    });
    if (r.status === 202) return { ok: true, motivo: "enviado pelo Microsoft Graph" };
    const texto = await r.text();
    let detalhe = texto.slice(0, 200);
    try {
      const j = JSON.parse(texto);
      detalhe = (j.error && j.error.message) || detalhe;
    } catch (_e) { /* deixa o texto cru */ }
    if (r.status === 403) {
      detalhe += " | o app do Azure precisa da permissao de aplicacao Mail.Send " +
                 "com consentimento do administrador";
    }
    return { ok: false, motivo: "Graph sendMail " + r.status + ": " + detalhe };
  } catch (e) {
    return { ok: false, motivo: String((e as Error).message || e) };
  }
}
