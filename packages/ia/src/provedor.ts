import type { z } from 'zod';

/** Um pedido ao modelo com resposta em JSON validada por schema. */
export interface PedidoIa<T> {
  /** Nome curto da tarefa, para o registro e o orcamento ('planejar', 'avaliar_oferta'). */
  tarefa: string;
  /** Instrucoes fixas do Frank (skills). Nunca recebe texto vindo de fora. */
  sistema: string;
  /** O pedido. Texto de fora (pagina, resposta de fonte) vai aqui, marcado como dado. */
  mensagem: string;
  /** Formato da resposta. Valida duas vezes: no proprio Claude (--json-schema) e aqui. */
  schema: z.ZodType<T>;
}

export interface RespostaIa<T> {
  dados: T;
  duracaoMs: number;
}

export interface ProvedorLLM {
  readonly nome: string;
  /** Lanca IaIndisponivelError ou RespostaIaInvalidaError; nunca devolve dado sem validar. */
  perguntar<T>(pedido: PedidoIa<T>): Promise<RespostaIa<T>>;
}

export type MotivoIndisponivel =
  | 'nao_instalado'
  | 'isolamento'
  | 'sem_login'
  | 'limite'
  | 'tempo'
  | 'orcamento'
  | 'falha';

/**
 * O Claude nao pode responder agora. O vigia segue sem ele (RF-11): a oferta fica "sem
 * avaliacao" e o painel mostra o motivo.
 */
export class IaIndisponivelError extends Error {
  constructor(
    readonly motivo: MotivoIndisponivel,
    mensagem: string,
    options?: { cause?: unknown },
  ) {
    super(mensagem, options);
    this.name = 'IaIndisponivelError';
  }
}

/** O Claude respondeu, mas fora do formato pedido. Tentar de novo uma vez pode resolver. */
export class RespostaIaInvalidaError extends Error {
  constructor(mensagem: string, options?: { cause?: unknown }) {
    super(mensagem, options);
    this.name = 'RespostaIaInvalidaError';
  }
}
