import {
  abrirBanco,
  type Banco,
  criarVigilancia,
  registrarPrecosVistos,
  salvarReferencias,
} from '@frank/banco';
import { beforeEach, describe, expect, it } from 'vitest';
import { detalheDaRota } from './rota';
import { EXEMPLOS, semearHistorico } from './teste/exemplo';

const AGORA = new Date('2027-01-20T15:00:00Z');
let db: Banco;
let id: string;

beforeEach(() => {
  db = abrirBanco(':memory:');
  id = criarVigilancia(
    db,
    (EXEMPLOS[0] as (typeof EXEMPLOS)[number]).vig,
    new Date('2026-12-01T00:00:00Z'),
  ).id;
});

const it0 = () => (EXEMPLOS[0] as (typeof EXEMPLOS)[number]).it;

describe('detalheDaRota', () => {
  it('null para vigilancia que nao existe', () => {
    expect(detalheDaRota(db, 'nao-existe', AGORA)).toBeNull();
  });

  it('sem dados: series vazias e sem preco normal', () => {
    const d = detalheDaRota(db, id, AGORA);
    expect(d?.frank).toEqual([]);
    expect(d?.google).toEqual([]);
    expect(d?.normal).toBeNull();
  });

  it('com poucas checagens, o normal vem do Google', () => {
    registrarPrecosVistos(db, id, 'r1', [it0()], new Date('2027-01-20T10:00:00Z'));
    const pontos = Array.from({ length: 10 }, (_, k) => ({
      dia: `2027-01-${String(k + 1).padStart(2, '0')}`,
      precoCentavos: 100_000 + k,
    }));
    salvarReferencias(db, id, 'google', 'BRL', pontos, AGORA);
    const d = detalheDaRota(db, id, AGORA);
    expect(d?.normal).toEqual({ centavos: 100_005, base: 'google' });
    expect(d?.frank).toHaveLength(1);
    expect(d?.google).toHaveLength(10);
  });

  it('com 20 checagens ou mais nos 14 dias, o normal e o proprio', () => {
    const rodadas = semearHistorico(db, id, AGORA, 12, 3);
    const d = detalheDaRota(db, id, AGORA);
    expect(rodadas).toBeGreaterThanOrEqual(20);
    expect(d?.normal?.base).toBe('proprio');
    expect(d?.frank).toHaveLength(rodadas);
  });

  it('tabela por dia (Brasilia), do mais novo ao mais antigo, com o menor do dia', () => {
    registrarPrecosVistos(
      db,
      id,
      'r1',
      [{ ...it0(), precoCentavos: 90_000 }],
      new Date('2027-01-20T01:00:00Z'),
    ); // 19/01 em Brasilia
    registrarPrecosVistos(
      db,
      id,
      'r2',
      [{ ...it0(), precoCentavos: 80_000 }],
      new Date('2027-01-20T13:00:00Z'),
    );
    registrarPrecosVistos(
      db,
      id,
      'r3',
      [{ ...it0(), precoCentavos: 85_000 }],
      new Date('2027-01-20T14:00:00Z'),
    );
    salvarReferencias(
      db,
      id,
      'google',
      'BRL',
      [{ dia: '2027-01-20', precoCentavos: 99_000 }],
      AGORA,
    );
    expect(detalheDaRota(db, id, AGORA)?.dias).toEqual([
      { dia: '2027-01-20', frank: 80_000, google: 99_000 },
      { dia: '2027-01-19', frank: 90_000, google: null },
    ]);
  });
});
