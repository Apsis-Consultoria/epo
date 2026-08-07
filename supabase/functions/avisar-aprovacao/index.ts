// Aviso para a gerencia da Claro: ha data esperando aprovacao.
//
// Quem chama, e por que dois caminhos:
//
//   1. A tela do cronograma, logo depois de a APSIS mandar a data. E o caminho
//      normal, e o que faz o e-mail chegar na hora - esperar a tarefa da
//      madrugada seria um dia inteiro de cronograma parado.
//   2. A tarefa diaria, com o segredo do agendador. E a rede de baixo: se a tela
//      fechou antes da chamada, se a internet caiu, se o e-mail falhou naquele
//      momento, a proxima passada pega o que ficou.
//
// Nos dois casos a pergunta e a mesma, e quem responde e o banco:
// aprovacoes_para_avisar() devolve o que esta esperando e ainda nao foi avisado.
// Por isso nao importa quantas vezes a tela chame - o que ja saiu nao sai de
// novo, e nao ha lista de ids vinda de fora para alguem forjar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { emailDatasParaAprovar, type DataParaAprovar } from "../_shared/email-claro.ts";
import { enviarPeloGraph } from "../_shared/enviar-email.ts";

const PROJETO_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SITE = ((Deno.env.get("APP_URL") || "https://auditoria.parceirosclaro.apsis.com.br/")
  .trim()).replace(/\/+$/, "");

// Quem manda data para aprovacao e a APSIS. A gerencia da Claro nao entra: ela e
// quem recebe este aviso.
const PAPEIS_OK = ["admin", "gestor", "auditor"];

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tarefa-avisos",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" }
  });
}

function dataBr(iso: string) {
  const p = String(iso || "").slice(0, 10).split("-");
  return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : String(iso || "");
}

type Linha = {
  item_id: string; email: string; nome: string; unidade: string;
  cidade: string; uf: string; data_inicio: string; data_fim: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, motivo: "metodo nao suportado" }, 405);

  const admin = createClient(PROJETO_URL, SERVICE, { auth: { persistSession: false } });

  // ------------------------------------------------------- quem esta chamando
  //
  // Duas portas, e nenhuma delas aberta. A chave publicavel do projeto esta no
  // JavaScript do site: sem conferir nada, qualquer um dispararia e-mail com a
  // marca da Claro para a gerencia da Claro.
  const segredoDaTarefa = req.headers.get("x-tarefa-avisos") || "";
  let autorizado = false;

  if (segredoDaTarefa) {
    const { data } = await admin.rpc("tarefa_avisos_autorizada", { p_valor: segredoDaTarefa });
    autorizado = data === true;
    if (!autorizado) {
      console.warn("aviso de aprovacao chamado com segredo de agendador que nao confere");
      return json({ ok: false, motivo: "nao autorizado" }, 403);
    }
  } else {
    const autorizacao = req.headers.get("Authorization") || "";
    if (!autorizacao) return json({ ok: false, motivo: "sem sessao" }, 401);

    const comoUsuario = createClient(PROJETO_URL, ANON, {
      global: { headers: { Authorization: autorizacao } },
      auth: { persistSession: false }
    });
    const { data: usuario, error: erro } = await comoUsuario.auth.getUser();
    if (erro || !usuario || !usuario.user) return json({ ok: false, motivo: "sessao invalida" }, 401);

    const { data: perfil } = await admin
      .from("perfis").select("papel").eq("user_id", usuario.user.id).maybeSingle();
    const papel = (perfil && (perfil as Record<string, string>).papel) || "";
    if (PAPEIS_OK.indexOf(papel) < 0) {
      return json({ ok: false, motivo: "seu papel nao envia data para aprovacao" }, 403);
    }
    autorizado = true;
  }

  // ------------------------------------------------------------------- a fila
  const { data, error } = await admin.rpc("aprovacoes_para_avisar");
  if (error) {
    console.warn("aprovacoes_para_avisar:", error.message);
    return json({ ok: false, motivo: "consulta falhou" }, 502);
  }

  const fila = (data || []) as Linha[];
  if (!fila.length) return json({ ok: true, na_fila: 0, enviados: 0 });

  // Um e-mail por gerente, com tudo que ele tem para aprovar.
  const porGerente = new Map<string, { nome: string; linhas: Linha[] }>();
  for (const l of fila) {
    const atual = porGerente.get(l.email);
    if (atual) atual.linhas.push(l);
    else porGerente.set(l.email, { nome: l.nome || "", linhas: [l] });
  }

  let enviados = 0;
  const falhas: string[] = [];

  for (const [email, g] of porGerente) {
    const itens: DataParaAprovar[] = g.linhas.map(function (l) {
      return {
        unidade: l.unidade || "",
        local: [l.cidade, l.uf].filter(Boolean).join("/"),
        data: dataBr(l.data_inicio),
        dataFim: l.data_fim ? dataBr(l.data_fim) : ""
      };
    });

    const n = itens.length;
    const assunto = n === 1
      ? "Uma data esperando a sua aprovação - Auditoria de EPOs"
      : n + " datas esperando a sua aprovação - Auditoria de EPOs";

    const r = await enviarPeloGraph(email, assunto,
      emailDatasParaAprovar({ nome: g.nome, itens: itens, link: SITE + "/cronograma" }));

    if (r.ok) {
      // Registra so o que saiu, e depois de sair. Registrar antes deixaria a
      // gerencia sem aviso nenhum se o envio falhasse: a proxima passada ja
      // veria tudo como avisado.
      for (const l of g.linhas) {
        await admin.rpc("aprovacao_aviso_registrar", {
          p_item: l.item_id, p_data: l.data_inicio, p_email: email
        });
      }
      enviados++;
    } else {
      // O endereco nao vai para o log: fica o motivo, que e o que ajuda.
      console.warn("aviso de aprovacao nao enviado:", r.motivo);
      falhas.push(String(r.motivo || ""));
    }
  }

  return json({ ok: true, na_fila: fila.length, gerentes: porGerente.size,
                enviados: enviados, falhas: falhas });
});
