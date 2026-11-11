import { describe, expect, it } from 'vitest';
import { type NovaVigilancia, novaVigilanciaSchema } from './vigilancia.js';

const vigilanciaExemplo: NovaVigilancia = {
  descricao: 'São Paulo → Recife, março, até R$ 800',
  origens: ['GRU', 'CGH', 'VCP'],
  destinos: ['REC'],
  idaDe: '2027-03-12',
  idaAte: '2027-03-12',
  voltaDe: '2027-03-19',
  voltaAte: '2027-03-19',
  adultos: 1,
  malasDespachadas: 0,
  maxEscalas: 1,
  companhias: [],
  aceitarPassagensSeparadas: false,
  precoAlvoCentavos: 80_000,
  moeda: 'BRL',
  intervaloMinutos: 60,
};

describe('novaVigilanciaSchema', () => {
  it('aceita uma vigilancia valida', () => {
    expect(novaVigilanciaSchema.parse(vigilanciaExemplo)).toEqual(vigilanciaExemplo);
  });

  it('aceita so ida', () => {
    const soIda = { ...vigilanciaExemplo, voltaDe: null, voltaAte: null };
    expect(novaVigilanciaSchema.safeParse(soIda).success).toBe(true);
  });

  it.each([
    ['dia que nao existe', { idaDe: '2027-02-30', idaAte: '2027-02-30' }],
    ['janela de ida invertida', { idaDe: '2027-03-12', idaAte: '2027-03-10' }],
    ['volta antes da ida', { voltaDe: '2027-03-01', voltaAte: '2027-03-01' }],
    ['so um lado da volta', { voltaAte: null }],
    ['intervalo menor que 30 min', { intervaloMinutos: 15 }],
    ['aeroporto em minusculas', { origens: ['gru'] }],
    ['campo desconhecido', { precoInventado: 1 }],
  ])('recusa %s', (_nome, mudanca) => {
    expect(novaVigilanciaSchema.safeParse({ ...vigilanciaExemplo, ...mudanca }).success).toBe(false);
  });
});
