import type { Centavos } from './dinheiro.js';

/**
 * IOF em compra com cartao brasileiro em vendedor estrangeiro: 3,5% desde 2025-07-17
 * (Decreto 12.499/2025), mesmo quando o site cobra em reais.
 */
export const IOF_VENDEDOR_ESTRANGEIRO = 0.035;

export interface EntradaPrecoFinal {
  precoCentavos: Centavos;
  /** Mala despachada que a pessoa pediu e a tarifa nao inclui. */
  malaCentavos?: Centavos;
  vendedorEstrangeiro: boolean;
}

export interface PrecoFinal {
  totalCentavos: Centavos;
  iofCentavos: Centavos;
}

/** Preco que a pessoa paga de verdade: passagem + mala + IOF quando o vendedor e estrangeiro. */
export function calcularPrecoFinal(entrada: EntradaPrecoFinal): PrecoFinal {
  const base = entrada.precoCentavos + (entrada.malaCentavos ?? 0);
  const iofCentavos = entrada.vendedorEstrangeiro ? Math.round(base * IOF_VENDEDOR_ESTRANGEIRO) : 0;
  return { totalCentavos: base + iofCentavos, iofCentavos };
}
