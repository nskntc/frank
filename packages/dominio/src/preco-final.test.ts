import { describe, expect, it } from 'vitest';
import { calcularPrecoFinal } from './preco-final.js';

describe('calcularPrecoFinal', () => {
  it('soma 3,5% de IOF em vendedor estrangeiro', () => {
    expect(calcularPrecoFinal({ precoCentavos: 109_200, vendedorEstrangeiro: true })).toEqual({
      totalCentavos: 113_022,
      iofCentavos: 3_822,
    });
  });

  it('nao soma IOF em vendedor brasileiro', () => {
    expect(calcularPrecoFinal({ precoCentavos: 109_200, vendedorEstrangeiro: false })).toEqual({
      totalCentavos: 109_200,
      iofCentavos: 0,
    });
  });

  it('inclui a mala antes do IOF', () => {
    const r = calcularPrecoFinal({
      precoCentavos: 100_000,
      malaCentavos: 20_000,
      vendedorEstrangeiro: true,
    });
    expect(r).toEqual({ totalCentavos: 124_200, iofCentavos: 4_200 });
  });
});
