import { beforeEach, describe, expect, it } from 'vitest';
import { abrirBanco, type Banco } from './abrir.js';
import { instante, vigilanciaExemplo } from './teste/dados.js';
import {
  apagarVigilancia,
  atualizarVigilancia,
  criarVigilancia,
  definirAtiva,
  listarVigilancias,
  obterVigilancia,
} from './vigilancias.js';

let db: Banco;
beforeEach(() => {
  db = abrirBanco(':memory:');
});

describe('vigilancias', () => {
  it('grava e le de volta todos os campos', () => {
    const criada = criarVigilancia(db, vigilanciaExemplo, instante('2026-11-11T12:00:00.000Z'));
    expect(criada.ativa).toBe(true);
    expect(obterVigilancia(db, criada.id)).toEqual({
      ...vigilanciaExemplo,
      id: criada.id,
      ativa: true,
      criadaEm: '2026-11-11T12:00:00.000Z',
      atualizadaEm: '2026-11-11T12:00:00.000Z',
      historicoDesde: '2026-11-11T12:00:00.000Z',
    });
  });

  it('recusa vigilancia fora do formato', () => {
    expect(() => criarVigilancia(db, { ...vigilanciaExemplo, intervaloMinutos: 5 })).toThrow();
    expect(listarVigilancias(db)).toHaveLength(0);
  });

  it('mudar so o preco-alvo mantem o historico', () => {
    const criada = criarVigilancia(db, vigilanciaExemplo, instante('2026-11-11T12:00:00.000Z'));
    const nova = atualizarVigilancia(
      db,
      criada.id,
      { ...vigilanciaExemplo, precoAlvoCentavos: 70_000 },
      instante('2026-11-12T08:00:00.000Z'),
    );
    expect(nova).toMatchObject({
      precoAlvoCentavos: 70_000,
      criadaEm: '2026-11-11T12:00:00.000Z',
      atualizadaEm: '2026-11-12T08:00:00.000Z',
      historicoDesde: '2026-11-11T12:00:00.000Z',
    });
  });

  it.each([
    ['destino', { destinos: ['SSA'] }],
    ['datas', { idaDe: '2027-07-10', idaAte: '2027-07-10', voltaDe: '2027-07-17', voltaAte: '2027-07-17' }],
    ['malas', { malasDespachadas: 1 }],
    ['moeda', { moeda: 'USD' }],
  ])('mudar %s recomeca o historico', (_nome, mudanca) => {
    const criada = criarVigilancia(db, vigilanciaExemplo, instante('2026-11-11T12:00:00.000Z'));
    const nova = atualizarVigilancia(
      db,
      criada.id,
      { ...vigilanciaExemplo, ...mudanca },
      instante('2026-11-12T08:00:00.000Z'),
    );
    expect(nova?.historicoDesde).toBe('2026-11-12T08:00:00.000Z');
  });

  it('pausa e lista so as ativas', () => {
    const a = criarVigilancia(db, vigilanciaExemplo);
    criarVigilancia(db, { ...vigilanciaExemplo, destinos: ['SSA'] });
    expect(definirAtiva(db, a.id, false)).toBe(true);
    expect(listarVigilancias(db)).toHaveLength(2);
    expect(listarVigilancias(db, { soAtivas: true }).map((v) => v.destinos)).toEqual([['SSA']]);
  });

  it('responde nulo ou falso para id que nao existe', () => {
    expect(obterVigilancia(db, 'nao-existe')).toBeNull();
    expect(atualizarVigilancia(db, 'nao-existe', vigilanciaExemplo)).toBeNull();
    expect(definirAtiva(db, 'nao-existe', false)).toBe(false);
    expect(apagarVigilancia(db, 'nao-existe')).toBe(false);
  });
});
