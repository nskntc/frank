import type { Itinerario } from '@frank/contratos';
import type { Dia } from '@frank/dominio';

/** O que o Frank pede a qualquer fonte de preco. */
export interface ConsultaVoo {
  /** Codigo IATA ou nome de cidade/aeroporto. */
  origem: string;
  destino: string;
  ida: Dia;
  /** Ultimo dia aceito para a ida (janela ida..idaAte). Omitido = so o dia `ida`. */
  idaAte?: Dia;
  /** Omitido = so ida. */
  volta?: Dia;
  /** Ultimo dia aceito para a volta (janela volta..voltaAte). */
  voltaAte?: Dia;
  /** Noites no destino, minimo e maximo (issue #24). So com volta. */
  noitesMin?: number;
  noitesMax?: number;
  adultos: number;
  /** Malas despachadas por adulto (0 a 2). */
  malasDespachadas?: number;
  maxEscalas?: number;
  /** So estas companhias (codigos IATA, ex.: ['AD']). Nao combina com `excluirCompanhias`. */
  companhias?: string[];
  /** Todas menos estas. Usado para achar voos escondidos pelo limite de resultados da fonte. */
  excluirCompanhias?: string[];
  aceitarPassagensSeparadas?: boolean;
  moeda: string;
}

export interface FontePreco {
  readonly nome: string;
  /**
   * Maximo de itinerarios que a fonte devolve por busca (Kiwi: 15). Resposta cheia = pode haver
   * voos escondidos, e o vigia busca de novo excluindo as companhias ja vistas. Omitido = sem limite.
   */
  readonly limiteResultados?: number;
  /** Quem vende pela fonte e estrangeiro: compra com cartao brasileiro paga IOF de 3,5%. */
  readonly vendedorEstrangeiro?: boolean;
  /** Nome do vendedor como aparece em "Onde comprar" (Kiwi: "Kiwi.com"). Padrao: `nome`. */
  readonly vendedor?: string;
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

/**
 * Por que o fetch nao trouxe resposta, em poucas palavras (issue #23): "tempo limite" (a fonte
 * nao respondeu a tempo) ou "sem conexao" (a rede local caiu, ex.: logo depois de acordar o
 * computador). So o codigo do erro entra na mensagem, nunca a URL (pode carregar chave).
 */
export function semResposta(erro: unknown, tempoLimiteMs: number): string {
  const nome = erro instanceof Error ? erro.name : '';
  if (nome === 'TimeoutError' || nome === 'AbortError') {
    return `sem resposta em ${Math.round(tempoLimiteMs / 1000)} s (tempo limite)`;
  }
  const causa = (erro as { cause?: { code?: unknown } } | null)?.cause;
  const codigo = causa?.code ?? (erro as { code?: unknown } | null)?.code;
  return typeof codigo === 'string' && /^[A-Z][A-Z0-9_]{1,39}$/.test(codigo)
    ? `sem conexão (${codigo})`
    : 'sem conexão';
}
