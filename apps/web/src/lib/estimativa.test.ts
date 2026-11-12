import { describe, expect, it } from 'vitest';
import { descreverRodizio, estimarConsultas, limitesDoAmbiente } from './estimativa';

const NORDESTE = {
  origens: ['CNF', 'PLU'],
  destinos: ['REC', 'SSA', 'FOR', 'MCZ', 'NAT'],
  intervaloMinutos: 60,
  companhias: [],
};

describe('estimarConsultas', () => {
  it('3 aeroportos para 1 destino, de hora em hora: 216 por dia, sem rodizio', () => {
    expect(
      estimarConsultas({
        origens: ['GRU', 'CGH', 'VCP'],
        destinos: ['REC'],
        intervaloMinutos: 60,
        companhias: [],
      }),
    ).toMatchObject({ pares: 3, paresPorRodada: 3, consultasPorDia: 216, ajustado: false });
  });

  it('aceite #19: 2 origens para 5 destinos cabem no teto com rodizio', () => {
    const e = estimarConsultas(NORDESTE);
    expect(e).toMatchObject({
      pares: 10,
      paresPorRodada: 3,
      consultasPorDia: 216,
      consultasSemRodizio: 720,
      ajustado: true,
    });
    expect(descreverRodizio(e)).toBe('todos os 10 pares a cada 4 h (3 por checagem)');
  });

  it('as outras rotas ativas dividem o teto', () => {
    const sozinha = estimarConsultas(NORDESTE);
    const comOutra = estimarConsultas(NORDESTE, [NORDESTE]);
    expect(comOutra.paresPorRodada).toBeLessThan(sozinha.paresPorRodada);
    expect(comOutra.consultasPorDia * 2).toBeLessThanOrEqual(240);
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

  it('usa o teto do .env, como o vigia; valor invalido fica no padrao', () => {
    expect(limitesDoAmbiente({ FRANK_TETO_DIARIO_FONTE: '1000' })).toEqual({
      tetoDiario: 1000,
      buscasPorPar: 3,
    });
    expect(
      limitesDoAmbiente({ FRANK_TETO_DIARIO_FONTE: 'abc', FRANK_MAX_BUSCAS_POR_PAR: '-1' }),
    ).toEqual({
      tetoDiario: 300,
      buscasPorPar: 3,
    });
    expect(estimarConsultas(NORDESTE, [], { tetoDiario: 1000, buscasPorPar: 3 }).ajustado).toBe(
      false,
    );
  });

  it('descreve tempos quebrados em horas e minutos', () => {
    const e = estimarConsultas({ ...NORDESTE, destinos: ['REC'], intervaloMinutos: 30 }, [
      NORDESTE,
      NORDESTE,
      NORDESTE,
    ]);
    expect(
      descreverRodizio({ ...e, pares: 2, paresPorRodada: 1, minutosParaCobrirTodos: 90 }),
    ).toBe('todos os 2 pares a cada 1 h 30 min (1 por checagem)');
  });
});
