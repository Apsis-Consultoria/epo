// Um endereco de e-mail que chegou de fora, normalizado ou recusado.
//
// Antes cada funcao conferia com /^\S+@\S+\.\S+$/. Aceita mais do que devia:
// \S+ inclui % e *. Como as consultas procuravam a pessoa com ilike - para nao
// errar por causa de maiuscula -, o valor entrava como PADRAO de busca e nao
// como endereco:
//
//   "%@apsis.com.br"  passava pela conferencia, e a busca casava com a primeira
//                     linha do dominio - a de um administrador, por exemplo;
//   "%@%.%"           casava com qualquer linha da lista de acessos;
//   e na limpeza dos codigos de entrada, delete ... ilike '%@%' apagaria o
//   codigo de entrada de todo mundo de uma vez.
//
// A correcao de fundo esta em outro lugar: o banco agora grava o endereco em
// minusculas (gatilho email_em_minusculas), e por isso as consultas passaram a
// usar eq, comparacao de igualdade, onde % e _ sao caracteres comuns. Este
// arquivo e o segundo cinto: recusa de saida o que nao tem cara de endereco, e
// devolve o valor pronto para comparar.
//
// O que a conferencia aceita: letras, numeros e . _ + - antes do @ (o sublinhado
// e o sinal de mais sao legitimos em e-mail de verdade), dominio com pelo menos
// um ponto, e nada de espaco.
//
// O % ficou de fora depois de um teste no ar: "%@apsis.com.br" passava, e como o
// sistema confia em todo endereco do proprio dominio, o pedido seguia inteiro -
// criou conta, gravou codigo e mandou mensagem para um endereco que nao existe.
// Endereco de gente nao tem %; deixar de aceitar custa nada e fecha o caminho de
// encher a lista de contas com lixo.
const FORMATO = /^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// Devolve o endereco pronto para comparar, ou "" quando nao serve.
export function emailNormalizado(valor: unknown): string {
  const e = String(valor == null ? "" : valor).trim().toLowerCase();
  if (e.length > 254) return "";          // limite do protocolo
  return FORMATO.test(e) ? e : "";
}
