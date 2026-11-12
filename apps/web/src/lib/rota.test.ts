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
      { dia: '2027-01-20', frank: 80_000, google: 99_000, link: it0().linkCompra },
      { dia: '2027-01-19', frank: 90_000, google: null, link: it0().linkCompra },
    ]);
  });
});

describe('mais barato agora', () => {
  const voo = (idNaFonte: string, preco: number, extra: object = {}) => ({
    ...it0(),
    idNaFonte,
    precoCentavos: preco,
    linkCompra: `https://www.kiwi.com/u/${idNaFonte}`,
    ...extra,
  });

  it('sem checagem, nada', () => {
    expect(detalheDaRota(db, id, AGORA)?.agora).toEqual([]);
  });

  it('os 3 mais baratos da ultima checagem, sem repetir voo nem misturar moeda', () => {
    registrarPrecosVistos(db, id, 'velha', [voo('v', 10_000)], new Date('2027-01-20T10:00:00Z'));
    registrarPrecosVistos(
      db,
      id,
      'nova',
      [
        voo('d', 130_000),
        voo('a', 100_000),
        voo('a', 100_000),
        voo('e', 5_000, { moeda: 'EUR' }),
        voo('b', 110_000),
        voo('c', 120_000),
      ],
      new Date('2027-01-20T14:00:00Z'),
    );
    const agora = detalheDaRota(db, id, AGORA)?.agora ?? [];
    expect(agora.map((v) => [v.itinerario.idNaFonte, v.precoCentavos, v.link])).toEqual([
      ['a', 100_000, 'https://www.kiwi.com/u/a'],
      ['b', 110_000, 'https://www.kiwi.com/u/b'],
      ['c', 120_000, 'https://www.kiwi.com/u/c'],
    ]);
    expect(agora[0]).toMatchObject({ vendedor: 'Kiwi.com', estrangeiro: true });
  });

  it('linha gravada fora do formato (link http, versao antiga) nao vira botao nem quebra a tela', () => {
    // O contrato recusa http na escrita; aqui a linha entra crua, como num banco antigo.
    db.prepare(
      `INSERT INTO precos_vistos (vigilancia_id, rodada, fonte, id_na_fonte, visto_em,
         preco_centavos, moeda, itinerario) VALUES (?, 'r', 'kiwi', 'x', ?, 100000, 'BRL', ?)`,
    ).run(
      id,
      '2027-01-20T14:00:00.000Z',
      JSON.stringify(voo('x', 100_000, { linkCompra: 'http://www.kiwi.com/u/x' })),
    );
    const d = detalheDaRota(db, id, AGORA);
    expect(d?.agora).toEqual([]);
    expect(d?.dias).toEqual([{ dia: '2027-01-20', frank: 100_000, google: null, link: null }]);
  });
});
