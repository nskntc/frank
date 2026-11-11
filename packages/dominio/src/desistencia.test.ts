import { describe, expect, it } from 'vitest';
import { lerDia } from './dia.js';
import { desistencia24h } from './desistencia.js';

describe('desistencia24h', () => {
  it('vale com exatamente 7 dias de antecedencia', () => {
    expect(desistencia24h(lerDia('2027-03-05'), lerDia('2027-03-12'))).toEqual({
      vale: true,
      diasDeAntecedencia: 7,
    });
  });

  it('nao vale com 6 dias', () => {
    expect(desistencia24h(lerDia('2027-03-06'), lerDia('2027-03-12')).vale).toBe(false);
  });

  it('vale com meses de antecedencia', () => {
    expect(desistencia24h(lerDia('2026-11-11'), lerDia('2027-03-12')).vale).toBe(true);
  });
});
