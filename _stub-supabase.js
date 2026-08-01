/* Stub temporario de teste: imita o PostgREST com os dados de producao. */
(function () {
  "use strict";

  var DADOS = window.__DADOS_TESTE__ || {};

  function resultado(rows) {
    return { data: rows, error: null, count: rows ? rows.length : 0, status: 200 };
  }

  function builder(tabela) {
    var linhas = (DADOS[tabela] || []).slice();
    var b = {
      _t: tabela,
      select: function () { return b; },
      eq: function (col, val) {
        linhas = linhas.filter(function (r) { return String(r[col]) === String(val); });
        return b;
      },
      order: function () { return b; },
      limit: function (n) { linhas = linhas.slice(0, n); return b; },
      maybeSingle: function () {
        return Promise.resolve({ data: linhas[0] || null, error: null });
      },
      insert: function () { return b; },
      update: function () { return b; },
      delete: function () { return b; },
      then: function (ok, falha) {
        console.log("[stub] consulta", tabela, linhas.length, "linhas");
        if (location.search.indexOf("falha=" + tabela) >= 0) {
          return Promise.resolve({
            data: null, error: { message: "permission denied", code: "42501" }, status: 403
          }).then(ok, falha);
        }
        return Promise.resolve(resultado(linhas)).then(ok, falha);
      }
    };
    return b;
  }

  window.supabase = {
    createClient: function () {
      return {
        from: builder,
        rpc: function () { return Promise.resolve({ data: null, error: null }); },
        functions: { invoke: function () { return Promise.resolve({ data: null, error: null }); } },
        auth: {
          getSession: function () {
            return Promise.resolve({
              data: { session: { user: { id: "u-admin", email: "admin@apsis.com.br" } } },
              error: null
            });
          }
        }
      };
    }
  };
})();
