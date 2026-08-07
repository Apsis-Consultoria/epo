// Aviso de acesso liberado.
// Serve para duas pessoas: o responsavel da unidade, cujo e-mail vem no
// relatorio pedido ou da lista de responsaveis dela, e quem a APSIS liberou na
// lista de acessos autorizados (gerente da Claro, coordenacao, consultor). Nos
// dois casos esta funcao garante que a conta de entrada existe e manda um e-mail
// dizendo que o acesso esta liberado e onde entrar.
//
// NAO existe senha neste sistema. Quem nao e da APSIS entra informando o e-mail
// na tela de entrada e digitando o codigo de seis digitos que chega nele na hora
// (funcoes enviar-codigo-entrada e confirmar-codigo-entrada); a equipe da APSIS
// entra pela conta Microsoft.
//
// Regras:
// - so admin, gestor ou cliente podem chamar (papel lido em perfis);
// - nenhuma credencial vai neste e-mail: antes ia um link de definir senha, que e
//   uma credencial numa caixa de e-mail, valida por horas;
// - o e-mail sai pelo Microsoft Graph, com o mesmo app do Azure que leva os
//   arquivos para a pasta oficial (permissao de aplicacao Mail.Send e o segredo
//   AZURE_REMETENTE com a caixa que assina a mensagem). Sem ele, devolve ok:false
//   com o motivo e nada e prometido na tela.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { emailAcessoResponsavel, emailAcessoDeAcompanhamento } from "../_shared/email-claro.ts";
import { enviarPeloGraph } from "../_shared/enviar-email.ts";
import { emailNormalizado } from "../_shared/endereco-email.ts";

const PROJETO_URL = Deno.env.get("SUPABASE_URL") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function segredo(nomes: string[]) {
  for (const nome of nomes) {
    const valor = (Deno.env.get(nome) || "").trim();
    if (valor) return valor;
  }
  return "";
}

const APP_URL = segredo(["APP_URL"]) || "https://auditoria.parceirosclaro.apsis.com.br/";

// Quem pode convidar responsavel de unidade. O gerente da Claro entra aqui
// porque e ele quem sabe o contato da unidade.
const PAPEIS_OK = ["admin", "gestor", "cliente"];
// Quem pode convidar alguem da lista de acessos autorizados. A gerencia da
// Claro entra: ela libera a propria equipe sem depender da APSIS.
const PAPEIS_OK_ACESSO = ["admin", "gestor", "cliente"];

// Mas nao libera QUALQUER papel. Esta e a mesma regra que o banco aplica
// (papel_liberavel_por): repetida aqui so para a recusa chegar em portugues,
// antes de o banco recusar em linguagem de banco.
//
// A gerencia da Claro nao cria equipe de campo. Quem preenche a auditoria e a
// APSIS; a Claro e a parte interessada no resultado. Se a contratante pudesse
// criar quem audita, a separacao entre quem avalia e quem e avaliado deixaria
// de existir e o resultado perderia valor como evidencia.
const PODE_LIBERAR: Record<string, string[]> = {
  admin: ["admin", "gestor", "auditor", "cliente", "responsavel"],
  gestor: ["auditor", "cliente", "responsavel"],
  cliente: ["cliente", "responsavel"]
};

const RECUSA: Record<string, string> = {
  admin: "somente um administrador envia acesso de administracao",
  gestor: "somente um administrador envia acesso de coordenacao",
  auditor: "equipe de campo e liberada pela APSIS"
};

// Os mesmos nomes que a tela de acessos mostra: o e-mail nao pode chamar o
// papel de um jeito e o sistema de outro.
const PAPEL_EM_PALAVRAS: Record<string, string> = {
  admin: "Admin Apsis",
  gestor: "Coordenação Apsis",
  auditor: "Equipe de Campo Apsis",
  cliente: "Gerencia Claro",
  responsavel: "Responsável pela EPO"
};

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" }
  });
}

// A tela de entrada. Antes isto apontava para a pagina de escolher senha, que
// deixou de existir: quem nao e da APSIS entra com um codigo que chega no e-mail.
//
// O endereco sai do APP_URL do projeto, e nao do cabecalho Origin do pedido.
// Antes vinha do Origin, conferido so no esquema (https): qualquer site em https
// servia. Como o e-mail leva a marca da Claro e diz "entre aqui", o endereco
// dentro dele nao pode ser escolhido por quem faz a chamada - senao a mensagem
// que a APSIS assina passa a apontar para a pagina de outra pessoa.
function destinoDaEntrada() {
  return APP_URL.replace(/[^/]*$/, "") + "login";
}

// ------------------------------------------------------------------ handler
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, motivo: "metodo nao suportado" }, 405);

  const autorizacao = req.headers.get("Authorization") || "";
  if (!autorizacao) return json({ ok: false, motivo: "sem sessao" }, 401);

  const comoUsuario = createClient(PROJETO_URL, ANON, {
    global: { headers: { Authorization: autorizacao } },
    auth: { persistSession: false }
  });

  const { data: usuario, error: erroUsuario } = await comoUsuario.auth.getUser();
  if (erroUsuario || !usuario || !usuario.user) return json({ ok: false, motivo: "sessao invalida" }, 401);

  const admin = createClient(PROJETO_URL, SERVICE, { auth: { persistSession: false } });

  const { data: perfil } = await admin
    .from("perfis").select("papel").eq("user_id", usuario.user.id).maybeSingle();
  const papel = (perfil && (perfil as Record<string, string>).papel) || "";
  if (PAPEIS_OK.indexOf(papel) < 0) {
    return json({ ok: false, motivo: "seu papel (" + (papel || "sem perfil") + ") nao pode dar acesso a responsavel" }, 403);
  }

  let corpo: Record<string, string> = {};
  try { corpo = await req.json(); } catch (_e) { corpo = {}; }

  let email = emailNormalizado(corpo.email);
  let contexto = "";
  let papelPretendido = "responsavel";
  // O e-mail cumprimenta pelo nome. Sem nome ele cumprimenta so com "Ola,".
  let nomeDaPessoa = "";
  const alocacaoId = String(corpo.alocacao_id || "").trim();
  const acessoId = String(corpo.acesso_id || "").trim();
  // Responsavel convidado pela LISTA da unidade (uma unidade pode ter mais de
  // um). Aqui vem o e-mail direto, e a unidade so serve para o e-mail dizer de
  // qual unidade se trata.
  const epoId = String(corpo.epo_id || "").trim();

  if (acessoId) {
    if (PAPEIS_OK_ACESSO.indexOf(papel) < 0) {
      return json({
        ok: false,
        motivo: "seu papel (" + (papel || "sem perfil") + ") nao pode liberar acesso ao sistema"
      }, 403);
    }
    const { data: linha, error } = await admin
      .from("acessos_autorizados")
      .select("id, email, nome, papel, ativo")
      .eq("id", acessoId).maybeSingle();
    if (error) {
      // A mensagem crua do Postgres nao volta para quem chamou: ela nomeia
      // tabela, coluna e politica, e um id fora do formato faz o banco devolver
      // o texto interno inteiro. Fica no log, que so quem opera le.
      console.error("falha ao ler a liberacao:", error.message);
      return json({ ok: false, motivo: "nao foi possivel ler a liberacao" }, 400);
    }
    if (!linha) return json({ ok: false, motivo: "liberacao nao encontrada" }, 404);
    const l = linha as Record<string, any>;
    if (!l.ativo) {
      return json({ ok: false, motivo: "esta liberacao esta desativada. Ative antes de convidar" }, 400);
    }
    email = emailNormalizado(l.email);
    papelPretendido = String(l.papel || "");
    const liberaveis = PODE_LIBERAR[papel] || [];
    if (liberaveis.indexOf(papelPretendido) < 0) {
      return json({ ok: false,
        motivo: RECUSA[papelPretendido] || "este acesso nao pode ser liberado por voce" }, 403);
    }
    contexto = PAPEL_EM_PALAVRAS[papelPretendido] || papelPretendido;
    nomeDaPessoa = String(l.nome || "");
  }

  if (alocacaoId) {
    const { data: linha, error } = await admin
      .from("alocacoes")
      .select("id, responsavel_email, epos(nome), processos(nome)")
      .eq("id", alocacaoId).maybeSingle();
    if (error) {
      console.error("falha ao ler o relatorio pedido:", error.message);
      return json({ ok: false, motivo: "nao foi possivel ler o relatorio pedido" }, 400);
    }
    if (!linha) return json({ ok: false, motivo: "relatorio pedido nao encontrado" }, 404);
    const l = linha as Record<string, any>;
    email = emailNormalizado(l.responsavel_email);
    const epo = l.epos ? l.epos.nome : "";
    const proc = l.processos ? l.processos.nome : "";
    contexto = [epo, proc].filter(Boolean).join(" - ");
  }

  // A conferencia do endereco vem ANTES de qualquer consulta que o use: era a
  // ultima coisa antes do envio, e no caminho da unidade o valor ja tinha sido
  // usado para procurar a pessoa.
  if (!email) return json({ ok: false, motivo: "e-mail invalido" }, 400);

  if (epoId && !alocacaoId && !acessoId) {
    const { data: uni } = await admin.from("epos").select("nome").eq("id", epoId).maybeSingle();
    if (uni && (uni as Record<string, string>).nome) {
      contexto = String((uni as Record<string, string>).nome);
    }
    const { data: quem } = await admin.from("epo_responsaveis")
      .select("nome").eq("epo_id", epoId).eq("email", email).maybeSingle();
    if (quem && (quem as Record<string, string>).nome) {
      nomeDaPessoa = String((quem as Record<string, string>).nome);
    }
  }

  // Conta ja existe? Decide entre convite e redefinicao, sem apagar nada.
  // Consulta direta: paginar a lista inteira lia ate 4000 contas por chamada e
  // parava de achar gente acima disso.
  let existente: { id: string } | null = null;
  try {
    const { data, error } = await admin.rpc("conta_por_email", { p_email: email });
    if (!error && data) existente = { id: String(data) };
  } catch (_e) { existente = null; }

  const destino = destinoDaEntrada();
  const novaConta = !existente;

  if (novaConta) {
    // Conta criada sem senha - e sem senha ela fica: a entrada e por codigo.
    const criada = await admin.auth.admin.createUser({
      email: email,
      email_confirm: true,
      user_metadata: { papel_pretendido: papelPretendido, contexto: contexto }
    });
    if (criada.error && !/already|registered|exists/i.test(String(criada.error.message || ""))) {
      // Mesma regra das leituras acima: o detalhe do servico de contas fica no
      // log, e quem chamou recebe a frase.
      console.error("conta de acesso nao criada:", criada.error.message);
      return json({ ok: false, motivo: "nao foi possivel criar o acesso" }, 502);
    }
    if (criada.data && criada.data.user) existente = { id: criada.data.user.id };
  }

  // Nenhuma credencial vai neste e-mail. Antes ia um link de definir senha, que
  // e uma credencial numa caixa de e-mail: valia por horas, e quem tivesse
  // acesso a caixa entrava. Agora o e-mail so avisa que o acesso esta liberado, e
  // a chave (o codigo de seis digitos) e pedida na hora de entrar, por quem esta
  // entrando.
  const link = destino;

  const assunto = novaConta
    ? "Seu acesso à Auditoria de EPOs" + (contexto ? " - " + contexto : "")
    : "Seu acesso à Auditoria de EPOs";
  // Dois e-mails diferentes, porque sao dois papeis diferentes.
  //
  // Quem entra pela LISTA DE ACESSOS acompanha a auditoria: gerencia da Claro,
  // coordenacao e equipe de campo. Nao tem unidade, nao recebe visita e nao
  // anexa documento nenhum.
  //
  // Quem entra por um PEDIDO ou pela lista de responsaveis de uma unidade e o
  // responsavel da EPO: e ele quem recebe a visita e anexa os documentos.
  //
  // Ate aqui os dois recebiam o mesmo texto - o do responsavel. A gerencia da
  // Claro era avisada de que "a sua unidade vai passar por uma auditoria" e de
  // que precisava anexar documento, o que inverte os papeis: diz a quem
  // fiscaliza que ele e o fiscalizado.
  const html = acessoId
    ? emailAcessoDeAcompanhamento({
        nome: nomeDaPessoa, email: email, link: link,
        papel: papelPretendido, contexto: contexto, novaConta: novaConta
      })
    : emailAcessoResponsavel({
        nome: nomeDaPessoa, email: email, link: link,
        contexto: contexto, novaConta: novaConta
      });

  // 1) Microsoft Graph, com a credencial que ja existe
  let envio = await enviarPeloGraph(email, assunto, html);

  // 2) sem Graph, nao existe reserva.
  //
  // Antes caia no envio do proprio servico de contas, que manda um link de
  // redefinir senha - e nao ha mais senha para redefinir, nem esse e-mail chega
  // com o nome da APSIS. Falhando o Graph, a tela recebe ok:false com o motivo e
  // ninguem promete nada a quem esta esperando.
  if (!envio.ok) {
    console.warn("envio do aviso de acesso falhou:", envio.motivo);
  }

  // Marca que a senha ainda nao foi definida por ele, para a tela cobrar - mas
  // SO para quem nunca definiu.
  //
  // A marca de "senha ainda nao definida" saiu junto com a senha: nao ha mais
  // tela para onde mandar quem nao definiu, porque nao ha mais o que definir.

  if (envio.ok && alocacaoId) {
    await admin.from("alocacoes")
      .update({ convite_enviado_em: new Date().toISOString() })
      .eq("id", alocacaoId);
  }

  if (envio.ok && acessoId) {
    await admin.from("acessos_autorizados")
      .update({ convidado_em: new Date().toISOString() })
      .eq("id", acessoId);
  }

  return json({
    ok: envio.ok,
    email: email,
    contexto: contexto,
    papel: papelPretendido,
    nova_conta: novaConta,
    motivo: envio.motivo
  }, envio.ok ? 200 : 502);
});
