// Verificador do envio de e-mail. Existe porque nao ha como reproduzir a falha
// do convite sem uma sessao de usuario, e o motivo ficava preso dentro da
// funcao de convite. Ja cumpriu esse papel no diagnostico de 30/07/2026,
// quando apontou AADSTS7000215 (segredo do Azure cadastrado com o ID em vez do
// valor), e no de 03/08/2026, quando confirmou Mail.Send concedido.
//
// Duas conferencias, as duas SEM enviar e-mail:
//   1. credencial do Azure e permissoes que o app realmente tem;
//   2. o caminho do convite ate o link de senha, com uma conta descartavel de
//      endereco fixo e invalido, apagada no fim.
//
// O que NAO faz, de proposito:
// - nao envia e-mail;
// - nao aceita endereco de fora: o e-mail da prova e fixo aqui dentro, senao
//   este endereco viraria um caminho aberto para sondar contas;
// - nao devolve segredo, cracha, nem o link gerado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { decodeBase64Url } from "https://deno.land/std@0.224.0/encoding/base64url.ts";

const PROJETO_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Dominio reservado para teste: nunca existe de verdade, nunca entrega nada.
const EMAIL_DA_PROVA = "prova.convite@apsis.invalid";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "Content-Type": "application/json" }
  });
}

function segredo(nomes: string[]) {
  for (const nome of nomes) {
    const valor = (Deno.env.get(nome) || "").trim();
    if (valor) return valor;
  }
  return "";
}

function dominio(email: string) {
  const i = email.indexOf("@");
  return i > 0 ? email.slice(i) : "(sem @)";
}

async function conferirAzure() {
  const tenant = segredo(["AZURE_TENANT_ID", "GRAPH_TENANT_ID"]);
  const clientId = segredo(["AZURE_CLIENT_ID", "GRAPH_CLIENT_ID"]);
  const clientSecret = segredo(["AZURE_CLIENT_SECRET", "GRAPH_CLIENT_SECRET"]);
  const remetente = segredo(["AZURE_REMETENTE", "GRAPH_REMETENTE"]);

  const conf = {
    tenant_preenchido: !!tenant,
    client_id_preenchido: !!clientId,
    client_secret_preenchido: !!clientSecret,
    remetente_preenchido: !!remetente,
    remetente_dominio: remetente ? dominio(remetente) : null
  };
  if (!tenant || !clientId || !clientSecret) {
    return { ok: false, etapa: "configuracao", motivo: "falta credencial do Azure", conf };
  }
  if (!remetente) {
    return { ok: false, etapa: "configuracao",
             motivo: "falta AZURE_REMETENTE com a caixa que envia", conf };
  }

  let token = "";
  try {
    const corpo = new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials"
    });
    const r = await fetch("https://login.microsoftonline.com/" + tenant + "/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: corpo.toString()
    });
    const j = await r.json();
    if (!r.ok || !j.access_token) {
      return { ok: false, etapa: "cracha",
               motivo: String(j.error_description || j.error || r.status).slice(0, 400), conf };
    }
    token = String(j.access_token);
  } catch (e) {
    return { ok: false, etapa: "cracha", motivo: String((e as Error).message || e).slice(0, 300), conf };
  }

  // As permissoes concedidas vem escritas dentro do proprio cracha, em "roles":
  // ler dai evita disparar um e-mail so para saber se pode.
  let papeis: string[] = [];
  try {
    const meio = token.split(".")[1] || "";
    const dados = JSON.parse(new TextDecoder().decode(decodeBase64Url(meio)));
    papeis = Array.isArray(dados.roles) ? dados.roles.map(String) : [];
  } catch (_e) { papeis = []; }

  const pode = papeis.indexOf("Mail.Send") >= 0;
  return {
    ok: pode,
    etapa: pode ? "pronto" : "permissao",
    motivo: pode
      ? "credencial valida e Mail.Send concedido"
      : "o app do Azure NAO tem a permissao de aplicacao Mail.Send com consentimento do administrador",
    permissoes_do_app: papeis, conf
  };
}

// Reproduz o caminho do convite: cria a conta e pede o link de senha. E aqui
// que estava o defeito - o tipo "invite" recebia 422 porque a conta acabara de
// ser criada. Nao envia nada, e desfaz tudo no fim.
async function provarLink() {
  if (!PROJETO_URL || !SERVICE) {
    return { ok: false, etapa: "configuracao", motivo: "funcao sem acesso ao projeto" };
  }
  const admin = createClient(PROJETO_URL, SERVICE, { auth: { persistSession: false } });
  const passos: string[] = [];
  let userId = "";

  async function limpar() {
    try {
      if (userId) {
        await admin.from("perfis").delete().eq("user_id", userId);
        await admin.auth.admin.deleteUser(userId);
      }
      await admin.from("acessos_autorizados").delete().eq("email", EMAIL_DA_PROVA);
    } catch (_e) { /* a limpeza nao pode derrubar o resultado */ }
  }

  try {
    await admin.from("acessos_autorizados").delete().eq("email", EMAIL_DA_PROVA);
    const lib = await admin.from("acessos_autorizados")
      .insert({ email: EMAIL_DA_PROVA, nome: "Prova do convite", papel: "auditor", ativo: true })
      .select("id").maybeSingle();
    if (lib.error) return { ok: false, etapa: "liberacao", motivo: lib.error.message, passos };
    passos.push("liberacao criada");

    const criada = await admin.auth.admin.createUser({
      email: EMAIL_DA_PROVA, email_confirm: true,
      user_metadata: { papel_pretendido: "auditor" }
    });
    if (criada.error || !criada.data || !criada.data.user) {
      await limpar();
      return { ok: false, etapa: "conta",
               motivo: String((criada.error && criada.error.message) || "conta nao criada"), passos };
    }
    userId = criada.data.user.id;
    passos.push("conta criada sem senha");

    const gerado = await admin.auth.admin.generateLink({
      type: "recovery", email: EMAIL_DA_PROVA,
      options: { redirectTo: "https://apsis-consultoria.github.io/epo/definir-senha.html" }
    });
    const props = gerado.data && (gerado.data.properties as Record<string, string> | undefined);
    const link = props ? props.action_link : "";
    if (gerado.error || !link) {
      await limpar();
      return { ok: false, etapa: "link",
               motivo: String((gerado.error && gerado.error.message) || "link nao gerado"), passos };
    }
    passos.push("link de senha gerado");

    // O link NAO volta na resposta. So o que se pode dizer dele sem expor nada.
    const info = {
      tem_link: true,
      aponta_para_definir_senha: link.indexOf("definir-senha.html") >= 0,
      tipo_no_link: link.indexOf("type=recovery") >= 0 ? "recovery" : "outro"
    };
    await limpar();
    passos.push("conta de prova apagada");
    return { ok: true, etapa: "pronto",
             motivo: "o caminho do convite chega ao link de senha", passos, link: info };
  } catch (e) {
    await limpar();
    return { ok: false, etapa: "inesperado", motivo: String((e as Error).message || e), passos };
  }
}

Deno.serve(async function (req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch (_e) { corpo = {}; }

  const azure = await conferirAzure();
  const resposta: Record<string, unknown> = { azure };

  if (corpo.provar_link === true) {
    resposta.caminho_do_convite = await provarLink();
  }
  return json(resposta, 200);
});
