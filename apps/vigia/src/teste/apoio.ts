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

const NOMES: Record<string, string> = { AD: 'Azul', LA: 'LATAM', G3: 'Gol' };

export function itinerario(idNaFonte: string, precoCentavos: number, de = 'GRU', companhia = 'AD'): Itinerario {
  const trecho = {
    de,
    para: 'REC',
    partida: '2027-03-12T08:00:00',
    chegada: '2027-03-12T11:00:00',
    companhia: NOMES[companhia] ?? companhia,
    codigoCompanhia: companhia,
    numeroVoo: `${companhia}0000`,
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
    readonly limiteResultados?: number,
    readonly vendedorEstrangeiro?: boolean,
  ) {}
  buscar(consulta: ConsultaVoo): Promise<Itinerario[]> {
    this.consultas.push(consulta);
    return this.responder(consulta);
  }
}

/**
 * Imita a Kiwi: um estoque de voos do mais barato ao mais caro, filtrado pela consulta
 * (companhias escolhidas ou excluidas), e no maximo `limite` na resposta.
 */
export function fonteComEstoque(estoque: Record<string, number>, limite = 15): FonteFalsa {
  const voos: Itinerario[] = [];
  let preco = 50_000;
  for (const [companhia, quantos] of Object.entries(estoque)) {
    for (let i = 0; i < quantos; i++) voos.push(itinerario(`${companhia}-${i}`, (preco += 100), 'GRU', companhia));
  }
  const fonte: FonteFalsa = new FonteFalsa(
    'kiwi-falsa',
    async (c) =>
      voos
        .filter((v) => {
          const cia = v.ida.trechos[0]?.codigoCompanhia ?? '';
          if (c.companhias?.length) return c.companhias.includes(cia);
          return !(c.excluirCompanhias ?? []).includes(cia);
        })
        .slice(0, limite),
    limite,
  );
  return fonte;
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
