import { describe, expect, it } from 'vitest';
import { estimarConsultas } from './estimativa';

describe('estimarConsultas', () => {
  it('3 aeroportos para 1 destino, de hora em hora: 216 por dia, cabe', () => {
    expect(
      estimarConsultas({
        origens: ['GRU', 'CGH', 'VCP'],
        destinos: ['REC'],
        intervaloMinutos: 60,
        companhias: [],
      }),
    ).toEqual({
      pares: 3,
      consultasPorDia: 216,
      cabeNoTeto: true,
    });
  });

  it('2 origens para 5 destinos: 720 por dia, nao cabe no teto de 300', () => {
    const e = estimarConsultas({
      origens: ['CNF', 'PLU'],
      destinos: ['REC', 'SSA', 'FOR', 'MCZ', 'NAT'],
      intervaloMinutos: 60,
      companhias: [],
    });
    expect(e).toEqual({ pares: 10, consultasPorDia: 720, cabeNoTeto: false });
  });

  it('companhia escolhida faz uma busca so por par', () => {
    expect(
      estimarConsultas({
        origens: ['CWB'],
        destinos: ['IGU'],
        intervaloMinutos: 120,
        companhias: ['LA'],
      }).consultasPorDia,
    ).toBe(12);
  });
});
