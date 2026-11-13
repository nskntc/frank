import { describe, expect, it } from 'vitest';
import {
  cabeNosFiltros,
  descreverFiltros,
  foraDaPreferencia,
  filtrosSchema,
  SEM_FILTROS,
  temFiltros,
} from './filtros.js';
import type { Itinerario, Perna } from './itinerario.js';
import { novaVigilanciaSchema } from './vigilancia.js';

const perna = (partida: string, chegada: string, horas: number): Perna => ({
  de: 'CWB',
  para: 'AUA',
  partida,
  chegada,
  duracaoSegundos: horas * 3600,
  escalas: 1,
  trechos: [
    {
      de: 'CWB',
      para: 'AUA',
      partida,
      chegada,
      companhia: 'Exemplo',
      codigoCompanhia: 'XX',
      numeroVoo: 'XX1',
    },
  ],
});

const voo = (ida: Perna, volta: Perna | null): Itinerario => ({
  fonte: 'kiwi',
  idNaFonte: 'x',
  precoCentavos: 100_000,
  moeda: 'BRL',
  linkCompra: 'https://www.kiwi.com/u/x',
  malas: { item: 1, mao: 1, despachada: 0 },
  ida,
  volta,
});

// Pedido do aceite: no maximo 12 h, chegar ate 17h na ida, voltar depois das 14h.
const F = {
  ...SEM_FILTROS,
  duracaoMaximaHoras: 12,
  idaChegadaAte: '17:00',
  voltaPartidaApos: '14:00',
};
const boaVolta = perna('2027-03-17T15:00:00', '2027-03-17T23:30:00', 10);

describe('cabeNosFiltros', () => {
  it('sem filtros, tudo cabe', () => {
    const v = voo(perna('2027-03-10T05:00:00', '2027-03-11T23:00:00', 40), null);
    expect(cabeNosFiltros(v, undefined)).toBe(true);
    expect(cabeNosFiltros(v, SEM_FILTROS)).toBe(true);
  });

  it('aceite #21: chegar as 22h na ida nao cabe; 16:40 cabe; 17:00 cabe (ate inclui)', () => {
    expect(
      cabeNosFiltros(voo(perna('2027-03-10T08:00:00', '2027-03-10T22:00:00', 11), boaVolta), F),
    ).toBe(false);
    expect(
      cabeNosFiltros(voo(perna('2027-03-10T06:00:00', '2027-03-10T16:40:00', 11), boaVolta), F),
    ).toBe(true);
    expect(
      cabeNosFiltros(voo(perna('2027-03-10T06:00:00', '2027-03-10T17:00:00', 11), boaVolta), F),
    ).toBe(true);
  });

  it('volta saindo cedo nao cabe; duracao longa nao cabe em nenhum trecho', () => {
    const ida = perna('2027-03-10T06:00:00', '2027-03-10T15:00:00', 9);
    expect(
      cabeNosFiltros(voo(ida, perna('2027-03-17T09:00:00', '2027-03-17T18:00:00', 9)), F),
    ).toBe(false);
    expect(
      cabeNosFiltros(voo(ida, perna('2027-03-17T15:00:00', '2027-03-18T08:00:00', 17)), F),
    ).toBe(false);
    expect(
      cabeNosFiltros(voo(perna('2027-03-09T20:00:00', '2027-03-10T15:00:00', 19), boaVolta), F),
    ).toBe(false);
  });

  it('so ida ignora os filtros de volta', () => {
    expect(
      cabeNosFiltros(voo(perna('2027-03-10T06:00:00', '2027-03-10T15:00:00', 9), null), F),
    ).toBe(true);
  });
});

describe('foraDaPreferencia', () => {
  it('diz em que o voo foge, trecho por trecho', () => {
    const v = voo(
      perna('2027-03-10T08:00:00', '2027-03-10T22:10:00', 15),
      perna('2027-03-17T09:00:00', '2027-03-17T18:00:00', 9),
    );
    expect(foraDaPreferencia(v, F)).toEqual([
      'ida chega 22:10 (você prefere até 17:00)',
      'ida leva 15 h (você prefere até 12 h)',
      'volta sai 09:00 (você prefere depois das 14:00)',
    ]);
    expect(foraDaPreferencia(v, undefined)).toEqual([]);
  });
});

describe('filtros no contrato', () => {
  it('vigilancia sem filtros continua valida; hora fora do formato e recusada', () => {
    const base = {
      descricao: 'x',
      origens: ['CWB'],
      destinos: ['AUA'],
      idaDe: '2027-03-10',
      idaAte: '2027-03-10',
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
    };
    expect(novaVigilanciaSchema.safeParse(base).success).toBe(true);
    expect(novaVigilanciaSchema.safeParse({ ...base, filtros: F }).success).toBe(true);
    expect(filtrosSchema.safeParse({ ...F, idaChegadaAte: '17h' }).success).toBe(false);
    expect(filtrosSchema.safeParse({ ...F, idaChegadaAte: '24:00' }).success).toBe(false);
    expect(filtrosSchema.safeParse({ ...F, extra: 1 }).success).toBe(false);
  });

  it('descreve para o painel', () => {
    expect(temFiltros(SEM_FILTROS)).toBe(false);
    expect(descreverFiltros(SEM_FILTROS)).toBeNull();
    expect(descreverFiltros(F)).toBe(
      'trechos de até 12 h · ida chegando até 17:00 · volta saindo depois das 14:00',
    );
  });
});
