import type { Itinerario } from '@frank/contratos';
import type { Dia } from '@frank/dominio';

/** O que o Frank pede a qualquer fonte de preco. */
export interface ConsultaVoo {
  /** Codigo IATA ou nome de cidade/aeroporto. */
  origem: string;
  destino: string;
  ida: Dia;
  /** Omitido = so ida. */
  volta?: Dia;
  adultos: number;
  /** Malas despachadas por adulto (0 a 2). */
  malasDespachadas?: number;
  maxEscalas?: number;
  /** Codigos IATA de companhia (ex.: ['AD']). A Kiwi devolve so 15 resultados por busca. */
  companhias?: string[];
  aceitarPassagensSeparadas?: boolean;
  moeda: string;
}

export interface FontePreco {
  readonly nome: string;
  /** Lanca FonteIndisponivelError ou RespostaInvalidaError; nunca devolve [] para esconder erro. */
  buscar(consulta: ConsultaVoo): Promise<Itinerario[]>;
}

/** A fonte nao respondeu, respondeu erro ou demorou demais. Vale tentar de novo depois. */
export class FonteIndisponivelError extends Error {
  constructor(
    readonly fonte: string,
    mensagem: string,
    options?: { cause?: unknown },
  ) {
    super(`${fonte}: ${mensagem}`, options);
    this.name = 'FonteIndisponivelError';
  }
}

/** A fonte respondeu num formato que o Frank nao reconhece. Tentar de novo nao resolve. */
export class RespostaInvalidaError extends Error {
  constructor(
    readonly fonte: string,
    mensagem: string,
    options?: { cause?: unknown },
  ) {
    super(`${fonte}: ${mensagem}`, options);
    this.name = 'RespostaInvalidaError';
  }
}
