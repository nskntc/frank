import { describe, expect, it } from 'vitest';
import { formatarReais, reaisParaCentavos, ValorInvalidoError } from './dinheiro.js';

describe('reaisParaCentavos', () => {
  it('converte o preco da fonte em centavos inteiros', () => {
    expect(reaisParaCentavos(1092.0)).toBe(109200);
  });

  it('arredonda o erro de ponto flutuante', () => {
    expect(reaisParaCentavos(0.1 + 0.2)).toBe(30);
  });

  it.each([Number.NaN, -1, Number.POSITIVE_INFINITY])('recusa %s', (valor) => {
    expect(() => reaisParaCentavos(valor)).toThrow(ValorInvalidoError);
  });
});

describe('formatarReais', () => {
  it('formata no padrao brasileiro', () => {
    expect(formatarReais(109200)).toBe('R$ 1.092,00');
  });
});
