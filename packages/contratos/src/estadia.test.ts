import { describe, expect, it } from 'vitest';
import { cabeNaEstadia, descreverEstadia, estadiaSchema, noitesNoDestino } from './estadia.js';
import type { Itinerario, Perna } from './itinerario.js';
import { novaVigilanciaSchema } from './vigilancia.js';

const perna = (partida: string, chegada: string): Perna => ({
  de: 'GYN',
  para: 'GIG',
  partida,
  chegada,
  duracaoSegundos: 6000,
  escalas: 0,
  trechos: [
    {
      de: 'GYN',
      para: 'GIG',
      partida,
      chegada,
      companhia: 'Exemplo',
      codigoCompanhia: 'XX',
      numeroVoo: 'XX1',
    },
  ],
});
const voo = (volta: Perna | null): Itinerario => ({
  fonte: 'kiwi',
  idNaFonte: 'x',
  precoCentavos: 100_000,
  moeda: 'BRL',
  linkCompra: 'https://www.kiwi.com/u/x',
  malas: { item: 1, mao: 1, despachada: 0 },
  ida: perna('2026-12-11T15:05:00', '2026-12-11T16:45:00'),
  volta,
});

describe('estadia (issue #24)', () => {
  it('conta noites do dia da chegada ao dia da volta; 33 noites nao cabe em 10 a 14', () => {
    const longa = voo(perna('2027-01-13T08:30:00', '2027-01-13T10:10:00'));
    expect(noitesNoDestino(longa)).toBe(33);
    expect(cabeNaEstadia(longa, { minNoites: 10, maxNoites: 14 })).toBe(false);
    const certa = voo(perna('2026-12-23T08:30:00', '2026-12-23T10:10:00'));
    expect(noitesNoDestino(certa)).toBe(12);
    expect(cabeNaEstadia(certa, { minNoites: 10, maxNoites: 14 })).toBe(true);
    expect(cabeNaEstadia(longa, undefined)).toBe(true);
    expect(noitesNoDestino(voo(null))).toBeNull();
  });

  it('contrato: min <= max; so com volta; descricao', () => {
    expect(estadiaSchema.safeParse({ minNoites: 14, maxNoites: 10 }).success).toBe(false);
    const base = {
      descricao: 'x',
      origens: ['GYN'],
      destinos: ['GIG'],
      idaDe: '2026-12-01',
      idaAte: '2026-12-31',
      voltaDe: null,
      voltaAte: null,
      adultos: 1,
      malasDespachadas: 0,
      maxEscalas: null,
      companhias: [],
      aceitarPassagensSeparadas: false,
      precoAlvoCentavos: null,
      moeda: 'BRL',
      intervaloMinutos: 60,
      estadia: { minNoites: 10, maxNoites: 14 },
    };
    expect(novaVigilanciaSchema.safeParse(base).success).toBe(false);
    expect(
      novaVigilanciaSchema.safeParse({ ...base, voltaDe: '2026-12-11', voltaAte: '2027-01-14' })
        .success,
    ).toBe(true);
    expect(descreverEstadia({ minNoites: 10, maxNoites: 14 })).toBe('de 10 a 14 noites');
    expect(descreverEstadia({ minNoites: 7, maxNoites: 7 })).toBe('7 noites');
  });
});
