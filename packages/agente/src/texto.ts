/**
 * Texto de fora vai ao Claude entre tags (<pedido>, <oferta>). Trocar `<` e `>` por aspas
 * angulares impede qualquer forma de fechar a tag (`<</pedido>/pedido>`, `</PEDIDO>`,
 * `</pedido >`): o texto nunca sai da area de dado.
 */
export function neutralizarTexto(texto: string): string {
  return texto.replaceAll('<', '‹').replaceAll('>', '›');
}

/** Qualquer jeito de escrever dinheiro. */
const DINHEIRO = [/R\s*\$/i, /\breais?\b/i, /\bBRL\b/i, /\bcentavos?\b/i, /\d{1,3}(?:[.,]\d{3})+/, /\d{3,}/];

/** Qualquer coisa com cara de endereco: dominio com ou sem barra, esquema, link markdown, e-mail. */
const LINK = [/:\/\//, /\]\(/, /@/, /\bwww\./i, /\b[a-z0-9-]{2,}\.[a-z]{2,}\b/i];

/**
 * Texto do modelo que vai para a tela (painel, Telegram) nao pode trazer preco nem link: os
 * numeros vem da fonte e URL nunca sai do texto do modelo (regra 1 do Frank). Normaliza antes
 * (NFKC: `Ｒ＄` vira `R$`, `ｈｔｔｐｓ` vira `https`). Anos (19xx, 20xx) podem aparecer.
 * Na duvida, bloqueia: quem chama troca o texto por um gerado pelo codigo.
 */
export function temPrecoOuLink(texto: string): boolean {
  const normal = texto.normalize('NFKC');
  const semAnos = normal.replace(/\b(?:19|20)\d{2}\b/g, '');
  return DINHEIRO.some((re) => re.test(semAnos)) || LINK.some((re) => re.test(normal));
}
