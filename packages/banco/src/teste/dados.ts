// Dados ficticios para os testes do banco (repo publico: nada de viagem real de ninguem).
import type { Itinerario, NovaVigilancia } from '@frank/contratos';

export const vigilanciaExemplo: NovaVigilancia = {
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

export function itinerarioExemplo(idNaFonte: string, precoCentavos: number): Itinerario {
  const trecho = {
    de: 'CGH',
    para: 'REC',
    partida: '2027-03-12T12:40:00',
    chegada: '2027-03-12T15:45:00',
    companhia: 'Azul',
    codigoCompanhia: 'AD',
    numeroVoo: 'AD0000',
  };
  return {
    fonte: 'kiwi',
    idNaFonte,
    precoCentavos,
    moeda: 'BRL',
    linkCompra: `https://www.kiwi.com/u/${idNaFonte}`,
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
}

export const instante = (iso: string): Date => new Date(iso);
