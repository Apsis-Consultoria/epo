// Avisos da visita para o responsavel da EPO.
//
// Sao tres momentos: a visita foi marcada, falta uma semana, e amanha. Os tres
// saem daqui, e nao de tres lugares diferentes: e o mesmo assunto, e escrito em
// separado ia divergir no primeiro ajuste.
//
// Como roda: uma tarefa diaria chama esta funcao sem corpo. Ela pergunta ao
// banco o que precisa ser avisado hoje (visitas_para_avisar), manda, e registra
// o que mandou. Tarefa diaria repete; o registro e o que impede o responsavel de
// receber o mesmo lembrete todo dia.
//
// Por que a decisao de "o que avisar" fica no banco e nao aqui: e uma pergunta
// sobre dados - qual visita esta a sete dias, quem responde por ela, quem ja foi
// avisado. Em SQL e uma consulta; aqui seriam tres consultas e a juncao na mao.
//
// Modo de teste: POST com { teste: "endereco@exemplo" } manda os tres modelos
// para aquele endereco, com uma unidade de exemplo, um e-mail por vez. Serve
// para conferir o desenho antes de qualquer visita real existir. Nao toca no
// banco e nao registra nada.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { emailAcessoResponsavel, emailVisitaMarcada, emailLembreteVisita,
         type Visita } from "../_shared/email-claro.ts";
import { enviarPeloGraph } from "../_shared/enviar-email.ts";

const PROJETO_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SITE = "https://apsis-consultoria.github.io/epo";

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

// 2026-08-09 -> 09/08/2026. O leitor de e-mail nao formata data.
function dataBr(iso: string) {
  const p = String(iso || "").slice(0, 10).split("-");
  return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : String(iso || "");
}

const ASSUNTO: Record<string, string> = {
  acesso: "Seu acesso a Auditoria de EPOs",
  marcada: "Visita marcada na sua unidade - Auditoria de EPOs",
  semana: "Falta uma semana para a visita - Auditoria de EPOs",
  dia: "A visita e amanha - Auditoria de EPOs"
};

function corpoDe(tipo: string, v: Visita) {
  if (tipo === "marcada") return emailVisitaMarcada(v);
  return emailLembreteVisita(v, tipo === "semana" ? 7 : 1);
}

// Unidade de exemplo para o modo de teste. Nome inventado de proposito: um
// e-mail de conferencia nao precisa levar o nome de uma unidade de verdade.
function visitaDeExemplo(): Visita {
  const d = new Date();
  d.setDate(d.getDate() + 9);
  const iso = d.toISOString().slice(0, 10);
  return {
    nome: "Responsavel",
    unidade: "EPO EXEMPLO SERVICOS LTDA",
    local: "Sao Paulo/SP",
    endereco: "Rua Exemplo, 100, Centro",
    data: dataBr(iso),
    checklists: ["Logistica Reversa", "Armazenagem & Facilities", "Recebimento & Expedicao"],
    link: SITE + "/checagem"
  };
}

// Quem ja recebe e-mail deste sistema: liberado na lista de acessos (e ativo),
// responsavel de alguma unidade, ou e-mail da propria casa.
async function recebeDoSistema(email: string) {
  const admin = createClient(PROJETO_URL, SERVICE, { auth: { persistSession: false } });
  if (email.endsWith("@apsis.com.br")) return true;

  const { data: liberado } = await admin.from("acessos_autorizados")
    .select("ativo").ilike("email", email).maybeSingle();
  if (liberado && (liberado as Record<string, unknown>).ativo === true) return true;

  const { data: resp } = await admin.from("epo_responsaveis")
    .select("epo_id").ilike("email", email).limit(1).maybeSingle();
  if (resp) return true;

  const { data: naUnidade } = await admin.from("epos")
    .select("id").ilike("responsavel_email", email).limit(1).maybeSingle();
  return !!naUnidade;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false }, 405);

  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch (_e) { corpo = {}; }

  // ------------------------------------------------------------ modo de teste
  const teste = String(corpo.teste || "").trim().toLowerCase();
  if (teste) {
    if (!/^\S+@\S+\.\S+$/.test(teste)) return json({ ok: false, motivo: "e-mail invalido" }, 400);

    // O modo de teste MANDA e-mail. Sem trava, este endereco viraria um jeito de
    // disparar mensagem com a marca da Claro para qualquer caixa do mundo, e a
    // chave publica do projeto basta para chamar. So vale para quem ja recebe
    // e-mail deste sistema - a mesma regra do envio do codigo de entrada.
    if (!await recebeDoSistema(teste)) {
      console.warn("teste de e-mail pedido para endereco que nao recebe deste sistema");
      return json({ ok: false, motivo: "endereco nao autorizado" }, 403);
    }

    const v = visitaDeExemplo();
    const feitos: Array<Record<string, unknown>> = [];
    // Os quatro avisos que o responsavel da EPO recebe, na ordem em que chegam
    // na vida real: acesso, visita marcada, uma semana antes, um dia antes.
    for (const tipo of ["acesso", "marcada", "semana", "dia"]) {
      const html = tipo === "acesso"
        ? emailAcessoResponsavel({ nome: v.nome, email: teste,
                                   link: SITE + "/login", contexto: "Responsável pela EPO",
                                   novaConta: true })
        : corpoDe(tipo, v);
      const r = await enviarPeloGraph(teste, "[TESTE] " + ASSUNTO[tipo], html);
      feitos.push({ tipo, enviado: r.ok, motivo: r.ok ? "" : r.motivo });
    }
    return json({ ok: true, modo: "teste", para: teste, enviados: feitos });
  }

  // -------------------------------------------------------------- tarefa diaria
  const admin = createClient(PROJETO_URL, SERVICE, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("visitas_para_avisar");
  if (error) {
    console.warn("visitas_para_avisar:", error.message);
    return json({ ok: false, motivo: "consulta falhou" }, 502);
  }

  const fila = (data || []) as Array<Record<string, string>>;
  let enviados = 0;
  const falhas: Array<Record<string, string>> = [];

  for (const linha of fila) {
    const v: Visita = {
      nome: linha.nome || "",
      unidade: linha.unidade || "",
      local: [linha.cidade, linha.uf].filter(Boolean).join("/"),
      endereco: linha.endereco || "",
      data: dataBr(linha.data_visita),
      dataFim: linha.data_fim ? dataBr(linha.data_fim) : "",
      link: SITE + "/checagem"
    };
    const r = await enviarPeloGraph(linha.email, ASSUNTO[linha.tipo] || ASSUNTO.marcada,
                                   corpoDe(linha.tipo, v));
    if (r.ok) {
      // Registra so quando saiu. Registrar antes deixaria a pessoa sem aviso se
      // o envio falhasse, porque a proxima passada ja veria como avisado.
      await admin.rpc("visita_aviso_registrar", {
        p_item: linha.item_id, p_tipo: linha.tipo,
        p_data: linha.data_visita, p_email: linha.email
      });
      enviados++;
    } else {
      // O endereco NAO vai para o log: fica o motivo e o tipo, que e o que
      // ajuda a entender a falha.
      console.warn("aviso de visita nao enviado (" + linha.tipo + "):", r.motivo);
      falhas.push({ tipo: linha.tipo, motivo: String(r.motivo || "") });
    }
  }

  return json({ ok: true, na_fila: fila.length, enviados: enviados, falhas: falhas });
});
