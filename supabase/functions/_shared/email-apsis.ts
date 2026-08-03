// O desenho dos e-mails do sistema, escrito uma vez.
//
// Existiam dois e-mails com layout diferente: o de acesso ganhou a identidade
// do Secure Share e o do codigo de seguranca continuou um bloco de texto sem
// marca. Escrito em cada funcao, ia divergir de novo no primeiro ajuste.
//
// Cuidados que o formato de e-mail impoe:
// - estilo em atributo, e nao em folha de estilo: leitor de e-mail ignora
//   <style> com frequencia;
// - charset declarado, senao acento chega trocado em parte dos leitores;
// - tabela para as linhas do quadro, porque nem todo leitor entende flex;
// - nenhuma imagem essencial: se a marca nao carregar, o texto continua de pe.
export const VERDE = "#1a4731";
export const LARANJA = "#f47920";
export const LOGO =
  "https://ybixbsfmxblaippubtvw.supabase.co/storage/v1/object/public/assets/logo_com_nome.png";

export function escapar(t: unknown) {
  return String(t == null ? "" : t)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
    const borda = ultimo ? "" : "border-bottom:1px solid #eef0ef;";
    return '<tr><td style="padding:9px 0;font-size:12.5px;color:#6b7280;width:78px;' + borda + '">' +
             par[0] + "</td>" +
           '<td style="padding:9px 0;font-size:13px;color:#111827;' + borda + '">' +
             par[1] + "</td></tr>";
  }).join("");
  return '<div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin:0 0 20px;">' +
    '<p style="margin:0 0 4px;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;' +
      'color:#9ca3af;">' + q.rotulo + "</p>" +
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%">' + linhas + "</table>" +
  "</div>";
}

function htmlDestaque(d: NonNullable<Email["destaque"]>) {
  // O codigo sai exatamente como deve ser digitado. Havia espaco entre os
  // digitos, para leitura, mas quem copiava o codigo colava os espacos junto
  // e a confirmacao nao batia.
  return '<div style="border:1px solid #e5e7eb;border-radius:10px;background:#f8faf9;' +
      'padding:18px 16px;margin:0 0 20px;text-align:center;">' +
      (d.legenda
        ? '<p style="margin:0 0 8px;font-size:10.5px;letter-spacing:.08em;' +
          'text-transform:uppercase;color:#9ca3af;">' + d.legenda + "</p>"
        : "") +
      '<p style="margin:0;font-size:30px;font-weight:700;color:' + VERDE + ';' +
        'font-family:Consolas,Menlo,monospace;">' + escapar(d.texto) +
      "</p>" +
    "</div>";
}

export function montarEmail(o: Email) {
  const paragrafos = (o.paragrafos || []).map(function (p) {
    return '<p style="margin:0 0 14px;font-size:13.5px;line-height:1.6;color:#374151;">' + p + "</p>";
  }).join("");

  const botao = o.botao
    ? '<a href="' + o.botao.href + '" style="display:block;background:' + LARANJA + ';' +
      'color:#ffffff;text-decoration:none;font-weight:600;font-size:14.5px;text-align:center;' +
      'padding:14px 18px;border-radius:8px;margin:0 0 18px;">' + o.botao.texto + " &rarr;</a>"
    : "";

  const aviso = o.aviso
    ? '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;' +
      'padding:11px 13px;margin:0 0 4px;">' +
      '<p style="margin:0;font-size:12px;line-height:1.55;color:#78350f;">' + o.aviso + "</p></div>"
    : "";

  const rodape = (o.rodape && o.rodape.length ? o.rodape : [
    "Este e-mail foi enviado pela Apsis Consultoria.",
    "Se você não esperava esta mensagem, ignore este e-mail."
  ]).join("<br>");

  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '</head><body style="margin:0;padding:0;background:#f4f6f5;">' +
    '<div style="max-width:520px;margin:0 auto;padding:24px 16px;' +
      'font-family:Segoe UI,Helvetica,Arial,sans-serif;">' +
      '<div style="border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">' +

        '<div style="background:' + VERDE + ';padding:26px 22px 22px;text-align:center;">' +
          '<div style="display:inline-block;background:#ffffff;border-radius:10px;' +
            'padding:11px 16px;margin-bottom:16px;">' +
            '<img src="' + LOGO + '" alt="Apsis Consultoria" width="112" ' +
              'style="display:block;width:112px;height:auto;border:0;">' +
          "</div>" +
          '<h1 style="margin:0 0 6px;font-size:17px;font-weight:600;color:#ffffff;">' +
            escapar(o.titulo) + "</h1>" +
          (o.subtitulo
            ? '<p style="margin:0;font-size:11.5px;color:#a7c4b5;">' + escapar(o.subtitulo) + "</p>"
            : "") +
        "</div>" +

        '<div style="background:#ffffff;padding:24px 22px 26px;">' +
          (o.saudacao
            ? '<p style="margin:0 0 14px;font-size:14px;font-weight:600;color:' + VERDE + ';">' +
              o.saudacao + "</p>"
            : "") +
          paragrafos +
          (o.quadro ? htmlQuadro(o.quadro) : "") +
          (o.destaque ? htmlDestaque(o.destaque) : "") +
          botao +
          aviso +
        "</div>" +
      "</div>" +
      '<p style="margin:14px 0 0;text-align:center;font-size:11px;line-height:1.6;color:#9ca3af;">' +
        rodape +
      "</p>" +
    "</div></body></html>";
}
