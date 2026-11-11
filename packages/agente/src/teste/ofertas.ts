// Ofertas ficticias para os testes e o eval do avaliador.
import type { Itinerario, Perna, Vigilancia } from '@frank/contratos';
import type { EntradaAvaliacao } from '../avaliar.js';

export const vigilanciaTeste: Vigilancia = {
  id: 'v-teste',
  descricao: 'São Paulo → Recife, março, até R$ 1.200',
  origens: ['GRU', 'CGH', 'VCP'],
  destinos: ['REC'],
  idaDe: '2027-03-12',
  idaAte: '2027-03-12',
  voltaDe: '2027-03-19',
  voltaAte: '2027-03-19',
  adultos: 1,
  malasDespachadas: 0,
  maxEscalas: null,
  companhias: [],
  aceitarPassagensSeparadas: false,
  precoAlvoCentavos: 120_000,
  moeda: 'BRL',
  intervaloMinutos: 60,
  ativa: true,
  criadaEm: '2026-11-01T00:00:00.000Z',
  atualizadaEm: '2026-11-01T00:00:00.000Z',
  historicoDesde: '2026-11-01T00:00:00.000Z',
  ultimaRodadaEm: null,
  ultimaRodadaResultado: null,
};

type Trecho = [de: string, para: string, partida: string, chegada: string, companhia?: string];

export function perna(...trechos: Trecho[]): Perna {
  const t = trechos.map(([de, para, partida, chegada, companhia = 'Azul']) => ({
    de,
    para,
    partida,
    chegada,
    companhia,
    codigoCompanhia: 'AD',
    numeroVoo: 'AD0000',
  }));
  const primeiro = t[0]!;
  const ultimo = t[t.length - 1]!;
  return {
    de: primeiro.de,
    para: ultimo.para,
    partida: primeiro.partida,
    chegada: ultimo.chegada,
    duracaoSegundos: (Date.parse(`${ultimo.chegada}Z`) - Date.parse(`${primeiro.partida}Z`)) / 1000,
    escalas: t.length - 1,
    trechos: t,
  };
}

export function itinerario(ida: Perna, volta: Perna | null, despachada = 0): Itinerario {
  return {
    fonte: 'kiwi',
    idNaFonte: 'exemplo',
    precoCentavos: 100_000,
    moeda: 'BRL',
    linkCompra: 'https://example.com/compra',
    malas: { item: 1, mao: 1, despachada },
    ida,
    volta,
  };
}

/** Direto nos dois sentidos, mesmo aeroporto, horarios de dia, com mala. */
export const vooLimpo = itinerario(
  perna(['CGH', 'REC', '2027-03-12T10:45:00', '2027-03-12T13:55:00']),
  perna(['REC', 'CGH', '2027-03-19T17:20:00', '2027-03-19T20:35:00']),
  1,
);

export function entrada(mudanca: Partial<EntradaAvaliacao> = {}): EntradaAvaliacao {
  return {
    vigilancia: vigilanciaTeste,
    itinerario: vooLimpo,
    precoFonteCentavos: 80_000,
    precoFinalCentavos: 80_000,
    precoNormalCentavos: 110_000,
    percentualAbaixo: 27,
    vendedorEstrangeiro: false,
    ...mudanca,
  };
}
