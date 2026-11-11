// Apoio aos testes do vigia: fonte falsa, log em memoria e dados ficticios.
import type { Itinerario, NovaVigilancia } from '@frank/contratos';
import type { ConsultaVoo, FontePreco } from '@frank/fontes';
import type { Logger } from '../log.js';

export const vigilanciaExemplo: NovaVigilancia = {
  descricao: 'São Paulo → Recife, março',
  origens: ['GRU', 'CGH'],
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
  precoAlvoCentavos: null,
  moeda: 'BRL',
  intervaloMinutos: 60,
};

export function itinerario(idNaFonte: string, precoCentavos: number, de = 'GRU'): Itinerario {
  const trecho = {
    de,
    para: 'REC',
    partida: '2027-03-12T08:00:00',
    chegada: '2027-03-12T11:00:00',
    companhia: 'Azul',
    codigoCompanhia: 'AD',
    numeroVoo: 'AD0000',
  };
  return {
    fonte: 'falsa',
    idNaFonte,
    precoCentavos,
    moeda: 'BRL',
    linkCompra: `https://example.com/${idNaFonte}`,
    malas: { item: 1, mao: 1, despachada: 0 },
    ida: { de, para: 'REC', partida: trecho.partida, chegada: trecho.chegada, duracaoSegundos: 10_800, escalas: 0, trechos: [trecho] },
    volta: null,
  };
}

/** Fonte que responde pelo `responder` e guarda as consultas recebidas. */
export class FonteFalsa implements FontePreco {
  readonly consultas: ConsultaVoo[] = [];
  constructor(
    readonly nome: string,
    private readonly responder: (c: ConsultaVoo) => Promise<Itinerario[]>,
  ) {}
  buscar(consulta: ConsultaVoo): Promise<Itinerario[]> {
    this.consultas.push(consulta);
    return this.responder(consulta);
  }
}

export function logEmMemoria(): Logger & { linhas: string[] } {
  const linhas: string[] = [];
  return {
    linhas,
    info(m) {
      linhas.push(`info ${m}`);
    },
    aviso(m) {
      linhas.push(`aviso ${m}`);
    },
    erro(m) {
      linhas.push(`erro ${m}`);
    },
  };
}
