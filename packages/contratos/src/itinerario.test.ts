import { describe, expect, it } from 'vitest';
import { itinerarioSchema } from './itinerario.js';

const trecho = {
  de: 'CGH',
  para: 'REC',
  partida: '2027-03-12T12:40:00',
  chegada: '2027-03-12T15:45:00',
  companhia: 'Azul',
  codigoCompanhia: 'AD',
  numeroVoo: 'AD0000',
};

const valido = {
  fonte: 'kiwi',
  idNaFonte: 'exemplo-1',
  precoCentavos: 109_200,
  moeda: 'BRL',
  linkCompra: 'https://www.kiwi.com/u/exemplo1',
  malas: { item: 1, mao: 1, despachada: 0 },
  ida: {
    de: 'CGH',
    para: 'REC',
    partida: trecho.partida,
    chegada: trecho.chegada,
    duracaoSegundos: 11_100,
    escalas: 0,
    trechos: [trecho],
  },
  volta: null,
};

describe('itinerarioSchema', () => {
  it('aceita um itinerario valido', () => {
    expect(itinerarioSchema.parse(valido)).toEqual(valido);
  });

  it.each(['javascript:alert(1)', 'http://www.kiwi.com/u/x', 'data:text/html,oi'])(
    'recusa link de compra %s',
    (link) => {
      expect(() => itinerarioSchema.parse({ ...valido, linkCompra: link })).toThrow();
    },
  );

  it('recusa preco em reais quebrados', () => {
    expect(() => itinerarioSchema.parse({ ...valido, precoCentavos: 1092.5 })).toThrow();
  });
});
