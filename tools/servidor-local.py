# -*- coding: utf-8 -*-
"""Servidor de desenvolvimento, para o navegador local se comportar como o ar.

O site publicado serve /epos como epos.html: quem hospeda resolve isso sozinho.
O servidor simples do Python nao resolve - devolve 404 - e testar com .html no
endereco enquanto no ar o endereco e sem .html significa testar outra coisa.

Este servidor faz a mesma resolucao: caminho sem extensao vira <caminho>.html
quando o arquivo existe. Nada aqui vai para o ar; e so para conferir.

Uso: python tools/servidor-local.py [porta]
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Manipulador(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=RAIZ, **kw)

    def translate_path(self, path):
        caminho = super().translate_path(path)
        # Diretorio e arquivo existente seguem como sempre.
        if os.path.isdir(caminho) or os.path.exists(caminho):
            return caminho
        # Sem extensao e com o .html do lado: e essa a pagina.
        raiz, ext = os.path.splitext(caminho)
        if not ext and os.path.isfile(raiz + ".html"):
            return raiz + ".html"
        return caminho

    def end_headers(self):
        # Sem cache no desenvolvimento: conferir uma correcao e recarregar a
        # pagina, nao adivinhar se o navegador guardou a versao velha.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, formato, *args):
        # Uma linha por pedido com erro; o resto e ruido.
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(formato, *args)


def main():
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8124
    servidor = ThreadingHTTPServer(("127.0.0.1", porta), Manipulador)
    print("servindo " + RAIZ + " em http://127.0.0.1:" + str(porta) +
          " (endereco sem .html resolve como no ar)")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
