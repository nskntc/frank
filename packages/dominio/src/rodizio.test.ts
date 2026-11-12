import { describe, expect, it } from 'vitest';
import { dividirOrcamento, planejarConsultas, planoComCota } from './rodizio.js';

const vig = (
  id: string,
  pares: number,
  extra: { buscasPorPar?: number; intervaloMinutos?: number } = {},
) => ({
  id,
  pares,
  buscasPorPar: extra.buscasPorPar ?? 3,
  intervaloMinutos: extra.intervaloMinutos ?? 60,
});

describe('dividirOrcamento', () => {
  it('quem precisa de pouco leva so o que precisa; a sobra vai para as maiores', () => {
    expect(dividirOrcamento([72, 720, 720], 240)).toEqual([72, 84, 84]);
  });

  it('tudo cabe: cada uma leva o que precisa', () => {
    expect(dividirOrcamento([10, 20], 240)).toEqual([10, 20]);
  });

  it('nunca passa do orcamento', () => {
    const cotas = dividirOrcamento([500, 7, 333, 90, 1000], 240);
    expect(cotas.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(240);
  });
});

describe('planejarConsultas', () => {
  it('aceite #19: 10 pares de hora em hora cabem no teto de 300, todos cobertos em 4 h', () => {
    const p = planejarConsultas([vig('praias', 10)], 300).get('praias');
    expect(p).toEqual({
      pares: 10,
      paresPorRodada: 3,
      intervaloMinutos: 60,
      consultasPorDia: 216,
      consultasSemRodizio: 720,
      minutosParaCobrirTodos: 240,
      ajustado: true,
    });
  });

  it('rota pequena nao muda nada', () => {
    const p = planejarConsultas([vig('recife', 3)], 300).get('recife');
    expect(p).toMatchObject({
      paresPorRodada: 3,
      intervaloMinutos: 60,
      consultasPorDia: 216,
      ajustado: false,
    });
  });

  it('varias rotas juntas: a soma cabe em 80% do teto e todas rodam', () => {
    const planos = planejarConsultas([vig('a', 10), vig('b', 10), vig('c', 1)], 300);
    const soma = [...planos.values()].reduce((t, p) => t + p.consultasPorDia, 0);
    expect(soma).toBeLessThanOrEqual(240);
    expect(planos.get('c')).toMatchObject({ ajustado: false });
    for (const p of planos.values()) expect(p.paresPorRodada).toBeGreaterThanOrEqual(1);
  });

  it('nem um par por rodada cabe: o intervalo aumenta', () => {
    const p = planoComCota(vig('larga', 25, { intervaloMinutos: 30 }), 48);
    expect(p.paresPorRodada).toBe(1);
    expect(p.intervaloMinutos).toBe(90);
    expect(p.consultasPorDia).toBeLessThanOrEqual(48);
    expect(p.minutosParaCobrirTodos).toBe(25 * 90);
    expect(p.ajustado).toBe(true);
  });

  it('companhia escolhida (1 busca por par) cabe mais pares por rodada', () => {
    const p = planejarConsultas([vig('la', 10, { buscasPorPar: 1 })], 300).get('la');
    expect(p).toMatchObject({ paresPorRodada: 10, consultasPorDia: 240, ajustado: false });
  });
});
