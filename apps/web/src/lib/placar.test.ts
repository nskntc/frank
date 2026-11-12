import type { AvisoEntregue, RegistroPlacar } from '@frank/banco';
import { describe, expect, it } from 'vitest';
import { instanteDeBrasilia, lerReais, montarPlacar, resultadoDoLance } from './placar';

const H = 3_600_000;
const T0 = Date.parse('2027-01-10T12:00:00Z');
const em = (horas: number) => new Date(T0 + horas * H).toISOString();
const frank = (horas: number, preco: number, moeda = 'BRL'): AvisoEntregue => ({
  enviadoEm: em(horas),
  precoCentavos: preco,
  moeda,
});
let id = 0;
const google = (horas: number, preco: number, confirmado = true): RegistroPlacar => ({
  id: ++id,
  vigilanciaId: 'v',
  quem: 'google',
  vistoEm: em(horas),
  precoCentavos: preco,
  moeda: 'BRL',
  confirmado,
  observacao: null,
});

describe('montarPlacar', () => {
  it('Frank avisou antes um preco igual ou menor: ponto do Frank, com a vantagem', () => {
    const p = montarPlacar([frank(0, 90_000)], [google(3, 90_000)], 'BRL');
    const g = p.linhas.find((l) => l.quem === 'google');
    expect(g).toMatchObject({ ponto: 'frank', motivo: 'frank_antes', vantagemFrankMs: 3 * H });
    // O aviso do Frank ja foi disputado no alerta do Google: nao conta duas vezes.
    expect(p.linhas[0]).toMatchObject({ quem: 'frank', ponto: null, motivo: 'disputado' });
    expect(p.pontos).toEqual({ frank: 1, google: 0 });
  });

  it('ate 2% a mais conta como o mesmo preco', () => {
    const p = montarPlacar([frank(0, 91_800)], [google(1, 90_000)], 'BRL');
    expect(p.linhas[1]).toMatchObject({ ponto: 'frank', motivo: 'frank_antes' });
    const longe = montarPlacar([frank(0, 92_000)], [google(1, 90_000)], 'BRL');
    expect(longe.linhas[1]).toMatchObject({ ponto: 'google', motivo: 'frank_nao_achou' });
  });

  it('Frank chegou depois, ou nunca: ponto do Google', () => {
    const p = montarPlacar([frank(5, 80_000)], [google(2, 85_000), google(8, 70_000)], 'BRL');
    expect(p.linhas.map((l) => [l.quem, l.ponto, l.motivo])).toEqual([
      ['google', 'google', 'frank_depois'],
      ['frank', null, 'disputado'],
      ['google', 'google', 'frank_nao_achou'],
    ]);
    expect(p.linhas[0]?.vantagemFrankMs).toBe(-3 * H);
    expect(p.pontos).toEqual({ frank: 0, google: 2 });
    expect(p.menor).toEqual({ frank: 80_000, google: 70_000 });
  });

  it('novo menor preco que o Google nunca avisou: so o Frank achou', () => {
    const p = montarPlacar(
      [frank(0, 95_000), frank(4, 99_000), frank(9, 70_000)],
      [google(1, 95_000)],
      'BRL',
    );
    expect(p.linhas.map((l) => l.motivo)).toEqual([
      'disputado',
      'frank_antes',
      'repetido',
      'so_frank',
    ]);
    expect(p.pontos).toEqual({ frank: 2, google: 0 });
  });

  it('Frank chegou primeiro a um preco, mesmo que o Google avise menos depois', () => {
    const p = montarPlacar([frank(0, 75_000)], [google(5, 69_000)], 'BRL');
    expect(p.linhas.map((l) => [l.motivo, l.ponto])).toEqual([
      ['frank_primeiro', 'frank'],
      ['frank_nao_achou', 'google'],
    ]);
    expect(p.pontos).toEqual({ frank: 1, google: 1 });
  });

  it('o Google ja tinha avisado menos antes: o novo menor do Frank nao conta', () => {
    const p = montarPlacar([frank(5, 75_000)], [google(0, 69_000)], 'BRL');
    expect(p.linhas.map((l) => [l.motivo, l.ponto])).toEqual([
      ['frank_nao_achou', 'google'],
      ['google_ja_tinha', null],
    ]);
  });

  it('ignora outra moeda e funciona sem dados', () => {
    expect(montarPlacar([frank(0, 50_000, 'USD')], [], 'BRL')).toEqual({
      linhas: [],
      pontos: { frank: 0, google: 0 },
      menor: { frank: null, google: null },
    });
  });
});

describe('instanteDeBrasilia', () => {
  it('converte o horario de Brasilia para UTC', () => {
    expect(instanteDeBrasilia('2027-01-10', '23:30')?.toISOString()).toBe(
      '2027-01-11T02:30:00.000Z',
    );
  });
  it('recusa data ou hora que nao existe', () => {
    expect(instanteDeBrasilia('2027-02-31', '10:00')).toBeNull();
    expect(instanteDeBrasilia('2027-01-10', '25:00')).toBeNull();
    expect(instanteDeBrasilia('10/01/2027', '10:00')).toBeNull();
  });
});

describe('lerReais', () => {
  it('aceita o jeito brasileiro e o com ponto', () => {
    expect(lerReais('1.234,56')).toBe(1234.56);
    expect(lerReais('R$ 987')).toBe(987);
    expect(lerReais('1.234')).toBe(1234);
    expect(lerReais('987.5')).toBe(987.5);
    expect(lerReais('899,9')).toBe(899.9);
  });
  it('recusa o que nao e valor', () => {
    expect(lerReais('')).toBeNull();
    expect(lerReais('abc')).toBeNull();
    expect(lerReais('0')).toBeNull();
    expect(lerReais('-10')).toBeNull();
  });
});

describe('resultadoDoLance', () => {
  it('explica cada linha em uma frase', () => {
    const p = montarPlacar(
      [frank(0, 90_000), frank(9, 60_000)],
      [google(3, 90_000), google(4, 50_000)],
      'BRL',
    );
    expect(p.linhas.map(resultadoDoLance)).toEqual([
      'Comparado com o alerta do Google',
      'O Frank já tinha avisado esse preço 3 h antes',
      'O Frank não avisou esse preço',
      'O Google já tinha avisado um preço igual ou menor',
    ]);
  });
});

describe('placar de exemplo (aceite da issue #16)', () => {
  it('rota de teste com dados ficticios: Frank 3 x 1 Google', async () => {
    const { abrirBanco, avisosEntregues, criarVigilancia, listarPlacar } =
      await import('@frank/banco');
    const { EXEMPLOS, semearPlacar } = await import('./teste/exemplo');
    const db = abrirBanco(':memory:');
    const agora = new Date('2027-01-20T15:00:00Z');
    const v = criarVigilancia(db, (EXEMPLOS[0] as (typeof EXEMPLOS)[number]).vig, agora).id;
    semearPlacar(db, v, agora);
    const p = montarPlacar(avisosEntregues(db, v), listarPlacar(db, v), 'BRL');
    expect(p.pontos).toEqual({ frank: 3, google: 1 });
    expect(p.menor).toEqual({ frank: 75_000, google: 89_500 });
    expect(p.linhas.map((l) => l.motivo)).toEqual([
      'disputado',
      'frank_antes',
      'frank_depois',
      'disputado',
      'disputado',
      'frank_antes',
      'so_frank',
    ]);
  });
});
