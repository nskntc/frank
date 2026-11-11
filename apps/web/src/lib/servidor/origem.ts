/**
 * Protecao da API local contra outra pagina aberta no mesmo navegador (CSRF): um site qualquer
 * poderia mandar um POST para http://127.0.0.1:4321 e criar vigilancias ou gastar o Claude.
 * Pedido que muda algo so passa se vier do proprio painel: Origin igual ao Host, e o Host e o
 * endereco local (contra DNS rebinding: um dominio de fora apontando para 127.0.0.1).
 */
const HOSTS_LOCAIS = /^(127\.0\.0\.1|localhost)(:\d+)?$/;

/** A pagina foi pedida pelo endereco local (barra DNS rebinding em leituras de pagina). */
export function hostLocal(cabecalhos: Headers): boolean {
  return HOSTS_LOCAIS.test(cabecalhos.get('host') ?? '');
}

export function pedidoDoPainel(cabecalhos: Headers): boolean {
  const host = cabecalhos.get('host') ?? '';
  if (!HOSTS_LOCAIS.test(host)) return false;
  const origem = cabecalhos.get('origin');
  if (origem) {
    try {
      return new URL(origem).host === host;
    } catch {
      return false;
    }
  }
  // Sem Origin (alguns navegadores em GET/HEAD): so aceita se o navegador disse que e o mesmo site.
  return cabecalhos.get('sec-fetch-site') === 'same-origin';
}
