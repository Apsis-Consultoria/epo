// O desenho dos e-mails do sistema, escrito uma vez.
//
// Existiam dois e-mails com layout diferente: o de acesso ganhou a identidade
// do Secure Share e o do codigo de seguranca continuou um bloco de texto sem
// marca. Escrito em cada funcao, ia divergir de novo no primeiro ajuste.
//
// A identidade e a da Claro, a mesma do painel: vermelho da marca #DA291C,
// texto #1F1D1D, apoio #525252, borda #DBDBDB, fundo #F8F8F8 e Roboto. Quem
// recebe estes e-mails e a gerencia da Claro e o responsavel da EPO, entao o
// e-mail chega com a cara de quem os convocou. Quem opera a auditoria aparece
// no rodape, como parceiro.
//
// Cuidados que o formato de e-mail impoe:
// - estilo em atributo, e nao em folha de estilo: leitor de e-mail ignora
//   <style> com frequencia;
// - charset declarado, senao acento chega trocado em parte dos leitores;
// - tabela para as linhas do quadro, porque nem todo leitor entende flex;
// - nenhuma imagem essencial: se a marca nao carregar, o texto continua de pe;
// - Roboto nao existe na maioria dos leitores: a pilha cai em Arial, que e a
//   substituta mais proxima e esta em todo lugar.
export const VERMELHO = "#DA291C";
export const VERMELHO_ESCURO = "#B41E13";
export const TEXTO = "#1F1D1D";
export const APOIO = "#525252";
export const FRACO = "#767676";
export const BORDA = "#DBDBDB";
export const FUNDO = "#F8F8F8";
export const FONTE = "Roboto,'Segoe UI',Helvetica,Arial,sans-serif";

// A logo sai do proprio site, que e publico. O endereco acompanha o APP_URL:
// com o dominio proprio no ar, o e-mail antigo continuaria buscando a imagem no
// endereco velho, e o dia em que ele parar de responder a marca some do e-mail.
const BASE_SITE = ((Deno.env.get("APP_URL") || "https://auditoria.parceirosclaro.apsis.com.br/")
  .trim()).replace(/\/+$/, "");
export const LOGO = BASE_SITE + "/assets/brand/logo-claro.png";

// Nome de unidade e endereco entram no HTML do e-mail. O apostrofo e o acento
// grave entraram na lista junto com os outros: sao delimitadores de atributo em
// leitor antigo, e um nome com apostrofo fecharia o atributo no meio.
export function escapar(t: unknown) {
  return String(t == null ? "" : t)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;").replace(/`/g, "&#96;");
}

// Primeiro nome so para decidir se ha nome; a saudacao usa o nome inteiro.
export function saudacaoDe(nome: string) {
  const limpo = (nome || "").trim();
  return limpo ? "Olá, " + escapar(limpo) + "," : "Olá,";
}

export type Email = {
  titulo: string;
  subtitulo?: string;
  saudacao?: string;
  paragrafos?: string[];                              // aceita <b> e <br>
  quadro?: { rotulo: string; linhas: Array<[string, string]> };
  destaque?: { texto: string; legenda?: string };     // o codigo, bem grande
  botao?: { texto: string; href: string };
  aviso?: string;                                     // caixa amarela
  rodape?: string[];
};

function htmlQuadro(q: NonNullable<Email["quadro"]>) {
  const linhas = q.linhas.map(function (par, i) {
    const ultimo = i === q.linhas.length - 1;
    const borda = ultimo ? "" : "border-bottom:1px solid " + BORDA + ";";
    return '<tr><td style="padding:9px 0;font-size:12.5px;color:' + FRACO + ';width:78px;' + borda + '">' +
             par[0] + "</td>" +
           '<td style="padding:9px 0;font-size:13px;color:' + TEXTO + ';' + borda + '">' +
             par[1] + "</td></tr>";
  }).join("");
  return '<div style="border:1px solid ' + BORDA + ';border-radius:12px;padding:14px 16px;margin:0 0 20px;">' +
    '<p style="margin:0 0 4px;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;' +
      'color:' + FRACO + ';">' + q.rotulo + "</p>" +
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%">' + linhas + "</table>" +
  "</div>";
}

function htmlDestaque(d: NonNullable<Email["destaque"]>) {
  // O codigo sai exatamente como deve ser digitado. Havia espaco entre os
  // digitos, para leitura, mas quem copiava o codigo colava os espacos junto
  // e a confirmacao nao batia.
  return '<div style="border:1px solid ' + BORDA + ';border-radius:12px;background:' + FUNDO + ';' +
      'padding:18px 16px;margin:0 0 20px;text-align:center;">' +
      (d.legenda
        ? '<p style="margin:0 0 8px;font-size:10.5px;letter-spacing:.08em;' +
          'text-transform:uppercase;color:' + FRACO + ';">' + d.legenda + "</p>"
        : "") +
      '<p style="margin:0;font-size:30px;font-weight:700;color:' + VERMELHO + ';' +
        'font-family:Consolas,Menlo,monospace;">' + escapar(d.texto) +
      "</p>" +
    "</div>";
}

// ---------------------------------------------------------------------------
// Aviso de acesso para quem ACOMPANHA a auditoria: gerencia da Claro,
// coordenacao da APSIS e equipe de campo.
//
// Existe separado do aviso do responsavel da EPO porque os dois papeis nao tem
// nada em comum. O responsavel RECEBE a visita e anexa os documentos da unidade
// dele; quem acompanha nao recebe visita nenhuma e nao tem unidade - ele le o
// que as unidades responderam.
//
// Ate agora os dois recebiam o mesmo texto, e a gerencia da Claro era avisada de
// que "a sua unidade vai passar por uma auditoria" e de que precisava anexar
// documento. Alem de errado, invertia os papeis: dizia a quem fiscaliza que ele
// e o fiscalizado.
// ---------------------------------------------------------------------------
export function emailAcessoDeAcompanhamento(o: {
  nome: string; email: string; link: string; papel: string; contexto?: string;
  novaConta: boolean;
}) {
  const papelNome = o.contexto ? " como <b>" + escapar(o.contexto) + "</b>" : "";
  const abertura = o.novaConta
    ? "Você recebeu acesso ao sistema de <b>Auditoria de EPOs</b> da Claro" + papelNome + "."
    : "O seu acesso ao sistema de <b>Auditoria de EPOs</b> da Claro continua liberado" +
      papelNome + ".";

  // O que a pessoa faz no sistema muda com o papel. Um texto so, generico,
  // deixaria de novo cada um adivinhando o que e esperado dele.
  const oQueFaz: Record<string, string> = {
    cliente:
      "Por ele você <b>acompanha as auditorias das unidades EPO</b>: o que cada " +
      "unidade respondeu em cada checklist, as evidências que ela anexou, a nota " +
      "e a posição no ranking.",
    auditor:
      "Por ele você <b>preenche as auditorias em campo</b>: responde os checklists " +
      "da visita, anexa as fotos e registra as não conformidades encontradas.",
    gestor:
      "Por ele você <b>coordena a auditoria</b>: monta o cronograma das visitas, " +
      "acompanha o preenchimento das equipes e confere o resultado de cada unidade.",
    admin:
      "Por ele você <b>administra o sistema</b>: cronograma, checklists, liberação " +
      "de acesso e o resultado de todas as unidades."
  };

  const paragrafos = [
    abertura,
    oQueFaz[o.papel] ||
      "Por ele você acompanha as auditorias das unidades EPO e o resultado de cada uma.",
    "Para entrar, informe o seu e-mail na tela de entrada. Um <b>código de seis " +
    "dígitos</b> chega neste endereço na hora, e você digita na tela. Não há senha " +
    "para criar nem para lembrar."
  ];

  return montarEmail({
    titulo: o.novaConta ? "Acesso à Auditoria de EPOs" : "Seu acesso à Auditoria de EPOs",
    subtitulo: "Auditoria de unidades EPO · Claro",
    saudacao: saudacaoDe(o.nome),
    paragrafos: paragrafos,
    quadro: {
      rotulo: "Como entrar",
      linhas: [
        ["Seu e-mail", '<span style="color:' + VERMELHO + ';">' + escapar(o.email) + "</span>"],
        ["Sua chave", '<span style="color:' + FRACO + ';">o código que chega aqui quando você pedir</span>']
      ]
    },
    botao: { texto: "Ir para a tela de entrada", href: o.link }
  });
}

// ---------------------------------------------------------------------------
// Aviso de acesso para o RESPONSAVEL DA EPO: a pessoa da unidade auditada.
// E a unica que recebe visita e anexa documento.
// ---------------------------------------------------------------------------
export function emailAcessoResponsavel(o: {
  nome: string; email: string; link: string; contexto?: string; novaConta: boolean;
}) {
  const papel = o.contexto ? " como <b>" + escapar(o.contexto) + "</b>" : "";
  const abertura = o.novaConta
    ? "Você recebeu acesso ao sistema de <b>Auditoria de EPOs</b> da Claro" + papel + "."
    : "O seu acesso ao sistema de <b>Auditoria de EPOs</b> da Claro continua liberado" +
      papel + ".";

  return montarEmail({
    titulo: o.novaConta ? "Acesso à Auditoria de EPOs" : "Seu acesso à Auditoria de EPOs",
    subtitulo: "Auditoria de unidades EPO · Claro",
    saudacao: saudacaoDe(o.nome),
    paragrafos: [
      abertura,
      // Sem isto o aviso dizia apenas que o acesso existe, e nao para que serve:
      // quem recebia guardava o e-mail e so descobria o que era esperado dele
      // quando a visita ja estava marcada.
      "A sua unidade vai passar por uma <b>auditoria</b>. A data ainda vai ser " +
      "marcada, e você recebe um aviso aqui quando ela for definida, com outro " +
      "lembrete uma semana antes e um dia antes.",
      "Até lá, <b>já pode entrar e anexar</b> os documentos e as fotos de cada " +
      "checklist da sua unidade. O que estiver anexado é o que a equipe confere no " +
      "lugar; o que faltar precisa ser levantado durante a visita.",
      "Para entrar, informe o seu e-mail na tela de entrada. Um <b>código de seis " +
      "dígitos</b> chega neste endereço na hora, e você digita na tela. Não há senha " +
      "para criar nem para lembrar."
    ],
    quadro: {
      rotulo: "Como entrar",
      linhas: [
        ["Seu e-mail", '<span style="color:' + VERMELHO + ';">' + escapar(o.email) + "</span>"],
        ["Sua chave", '<span style="color:' + FRACO + ';">o código que chega aqui quando você pedir</span>']
      ]
    },
    botao: { texto: "Ir para a tela de entrada", href: o.link }
  });
}

// ---------------------------------------------------------------------------
// Os avisos da visita, para o responsavel da EPO.
//
// Sao tres momentos do mesmo assunto: a visita foi marcada, falta uma semana,
// e amanha. O texto muda o suficiente para a pessoa saber em qual dos tres ela
// esta, e o quadro com unidade e data e o mesmo nos tres - quem recebe o
// terceiro nao precisa procurar o primeiro para lembrar o endereco.
//
// O que se pede e sempre o mesmo: anexar os documentos ANTES do dia. Por isso o
// botao leva direto para a tela de evidencias, e nao para a inicial.
// ---------------------------------------------------------------------------
export type Visita = {
  nome: string;              // de quem recebe
  unidade: string;
  local?: string;            // cidade/UF
  endereco?: string;
  data: string;              // ja formatada, ex. "09/08/2026"
  dataFim?: string;          // quando a visita leva mais de um dia
  checklists?: string[];     // o que foi pedido para aquela unidade
  link: string;              // tela de evidencias
};

function quadroDaVisita(v: Visita) {
  const linhas: Array<[string, string]> = [
    ["Unidade", "<b>" + escapar(v.unidade) + "</b>"],
    ["Data", '<b style="color:' + VERMELHO + ';">' + escapar(v.data) +
             (v.dataFim && v.dataFim !== v.data ? " a " + escapar(v.dataFim) : "") + "</b>"]
  ];
  if (v.local) linhas.push(["Cidade", escapar(v.local)]);
  if (v.endereco) linhas.push(["Endereço", escapar(v.endereco)]);
  if (v.checklists && v.checklists.length) {
    linhas.push(["Checklists", v.checklists.map(escapar).join("<br>")]);
  }
  return { rotulo: "A visita", linhas: linhas };
}

const PEDIDO =
  "Anexe no sistema, <b>antes do dia da visita</b>, os documentos e as fotos de " +
  "cada checklist da sua unidade. O que estiver anexado é o que a equipe confere " +
  "no lugar - o que faltar precisa ser levantado na hora, e isso atrasa a visita.";

export function emailVisitaMarcada(v: Visita) {
  return montarEmail({
    titulo: "Visita marcada na sua unidade",
    subtitulo: "Auditoria de unidades EPO · Claro",
    saudacao: saudacaoDe(v.nome),
    paragrafos: [
      "A auditoria da sua unidade foi <b>marcada</b>. O período de vistoria está " +
      "sendo informado abaixo.",
      "<b>Instruções:</b>",
      "Acesse o portal Auditoria Claro. Lá, haverá as informações e documentos solicitados."
    ],
    quadro: quadroDaVisita(v),
    botao: { texto: "Anexar os documentos", href: v.link }
  });
}

export function emailLembreteVisita(v: Visita, dias: number) {
  const umaSemana = dias > 1;
  return montarEmail({
    titulo: umaSemana ? "Falta uma semana para a visita" : "A visita é amanhã",
    subtitulo: "Auditoria de unidades EPO · Claro",
    saudacao: saudacaoDe(v.nome),
    paragrafos: [
      umaSemana
        ? "A auditoria da sua unidade acontece <b>na próxima semana</b>, na data abaixo."
        : "A auditoria da sua unidade é <b>amanhã</b>, na data abaixo.",
      umaSemana
        ? PEDIDO
        : "Se ainda falta algum documento ou foto, <b>anexe hoje</b>. O que não " +
          "estiver no sistema precisa ser levantado durante a visita."
    ],
    quadro: quadroDaVisita(v),
    botao: { texto: umaSemana ? "Anexar os documentos" : "Conferir o que falta", href: v.link }
  });
}

// ---------------------------------------------------------------------------
// Datas esperando aprovacao da Claro.
//
// Quando a APSIS manda uma data para aprovacao, o item fica parado ate alguem da
// gerencia da Claro entrar e responder. Sem aviso, esse "ate alguem entrar" nao
// tem prazo: o cronograma ficava esperando uma pessoa que nao sabia que estava
// sendo esperada.
//
// Um e-mail por gerente com TODAS as unidades esperando, e nao um por unidade:
// cadastrar o cronograma de um ciclo sao dezenas de unidades de uma vez, e
// dezenas de e-mails iguais viram caixa de spam - o aviso que chega demais e o
// aviso que ninguem le.
// ---------------------------------------------------------------------------
export type DataParaAprovar = {
  unidade: string;
  local?: string;
  data: string;
  dataFim?: string;
};

export function emailDatasParaAprovar(o: {
  nome: string;
  itens: DataParaAprovar[];
  link: string;
}) {
  const n = o.itens.length;
  const uma = n === 1;

  // Ate dez na lista. Passando disso o e-mail vira uma planilha, e a planilha
  // de verdade esta na tela - que e para onde o botao leva.
  const mostrar = o.itens.slice(0, 10);
  const sobra = n - mostrar.length;

  const linhas: Array<[string, string]> = mostrar.map(function (i): [string, string] {
    const quando = i.dataFim && i.dataFim !== i.data
      ? escapar(i.data) + " a " + escapar(i.dataFim)
      : escapar(i.data);
    return [quando, escapar(i.unidade) + (i.local ? " · " + escapar(i.local) : "")];
  });

  const paragrafos = [
    uma
      ? "A APSIS enviou <b>uma data</b> para a sua aprovação."
      : "A APSIS enviou <b>" + n + " datas</b> para a sua aprovação.",
    "No portal você <b>aprova a data</b> ou <b>sugere outra</b>. Enquanto não " +
    "houver resposta, a visita não é marcada e o responsável da unidade não é avisado."
  ];
  if (sobra > 0) {
    paragrafos.push("Abaixo estão as dez primeiras. As outras <b>" + sobra +
      "</b> estão no portal.");
  }

  return montarEmail({
    titulo: uma ? "Uma data esperando a sua aprovação" : "Datas esperando a sua aprovação",
    subtitulo: "Auditoria de unidades EPO · Claro",
    saudacao: saudacaoDe(o.nome),
    paragrafos: paragrafos,
    quadro: { rotulo: uma ? "Data enviada" : "Datas enviadas", linhas: linhas },
    botao: { texto: uma ? "Aprovar ou sugerir outra data" : "Aprovar ou sugerir outras datas",
             href: o.link }
  });
}

export function montarEmail(o: Email) {
  const paragrafos = (o.paragrafos || []).map(function (p) {
    return '<p style="margin:0 0 14px;font-size:13.5px;line-height:1.6;color:' + APOIO + ';">' + p + "</p>";
  }).join("");

  // Botao em capsula, como o da Claro. O leitor que ignorar o raio mostra um
  // retangulo cheio, que continua sendo um botao.
  const botao = o.botao
    ? '<a href="' + o.botao.href + '" style="display:block;background:' + VERMELHO + ';' +
      'color:#ffffff;text-decoration:none;font-weight:500;font-size:14.5px;text-align:center;' +
      'padding:14px 18px;border-radius:500px;margin:0 0 18px;">' + o.botao.texto + " &rarr;</a>"
    : "";

  // Caixa de atencao no amarelo da Claro.
  const aviso = o.aviso
    ? '<div style="background:#FFFAAD;border:1px solid #FFC722;border-radius:8px;' +
      'padding:11px 13px;margin:0 0 4px;">' +
      '<p style="margin:0;font-size:12px;line-height:1.55;color:#B84D01;">' + o.aviso + "</p></div>"
    : "";

  // A ultima linha diz de onde vem a mensagem: o sistema e da Claro, e quem o
  // opera e parceiro dela. Sem isso, quem recebe ve o nome de uma empresa que
  // nao reconhece num e-mail com a marca de outra.
  // Nao ha mais o "se nao esperava, ignore": estes e-mails pedem uma acao de
  // quem responde pela unidade, e convidar a ignorar era convidar a nao fazer.
  const rodape = (o.rodape && o.rodape.length ? o.rodape : [
    "Este e-mail faz parte da Auditoria de EPOs da Claro."
  ]).concat([
    "A Apsis Consultoria é parceira da Claro e responsável pela operação desta auditoria."
  ]).join("<br>");

  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '</head><body style="margin:0;padding:0;background:' + FUNDO + ';">' +
    '<div style="max-width:520px;margin:0 auto;padding:24px 16px;' +
      'font-family:' + FONTE + ';">' +
      '<div style="border-radius:12px;overflow:hidden;border:1px solid ' + BORDA + ';">' +

        '<div style="background:' + VERMELHO + ';padding:26px 22px 22px;text-align:center;">' +
          // O logo da Claro e vermelho: sobre o vermelho da marca ele some.
          // A caixa branca e o que o deixa legivel no topo colorido.
          '<div style="display:inline-block;background:#ffffff;border-radius:12px;' +
            'padding:11px 16px;margin-bottom:16px;">' +
            '<img src="' + LOGO + '" alt="Claro" width="112" ' +
              'style="display:block;width:112px;height:auto;border:0;">' +
          "</div>" +
          '<h1 style="margin:0 0 6px;font-size:17px;font-weight:700;color:#ffffff;">' +
            escapar(o.titulo) + "</h1>" +
          (o.subtitulo
            ? '<p style="margin:0;font-size:11.5px;color:#FFE3E3;">' + escapar(o.subtitulo) + "</p>"
            : "") +
        "</div>" +

        '<div style="background:#ffffff;padding:24px 22px 26px;">' +
          (o.saudacao
            ? '<p style="margin:0 0 14px;font-size:14px;font-weight:500;color:' + TEXTO + ';">' +
              o.saudacao + "</p>"
            : "") +
          paragrafos +
          (o.quadro ? htmlQuadro(o.quadro) : "") +
          (o.destaque ? htmlDestaque(o.destaque) : "") +
          botao +
          aviso +
        "</div>" +
      "</div>" +
      '<p style="margin:14px 0 0;text-align:center;font-size:11px;line-height:1.6;color:' + FRACO + ';">' +
        rodape +
      "</p>" +
    "</div></body></html>";
}
