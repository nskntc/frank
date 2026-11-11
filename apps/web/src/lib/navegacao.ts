export interface ItemNavegacao {
  href: string;
  rotulo: string;
}

/** As cinco telas do painel (SPEC-01, RF-18). O detalhe da rota abre a partir de Rotas. */
export const NAVEGACAO: readonly ItemNavegacao[] = [
  { href: '/', rotulo: 'Ofertas' },
  { href: '/rotas', rotulo: 'Rotas' },
  { href: '/placar', rotulo: 'Placar' },
  { href: '/configuracoes', rotulo: 'Configurações' },
];

/** O item ativo: igual ao caminho, ou prefixo dele (exceto a raiz, que so casa com ela mesma). */
export function itemAtivo(caminho: string, href: string): boolean {
  if (href === '/') return caminho === '/';
  return caminho === href || caminho.startsWith(`${href}/`);
}
