/** Uma mensagem de aviso, sempre em texto puro (nada de HTML montado com texto de fora). */
export interface MensagemAlerta {
  assunto: string;
  texto: string;
}

/** Um jeito de avisar a pessoa (SPEC-01 RF-15). Cada canal e opcional. */
export interface CanalAlerta {
  readonly nome: string;
  /** Lanca CanalFalhouError se nao conseguiu entregar. Nunca devolve sucesso sem ter enviado. */
  enviar(mensagem: MensagemAlerta): Promise<void>;
}

/** O envio falhou. A mensagem nunca carrega senha, token ou o texto do aviso. */
export class CanalFalhouError extends Error {
  constructor(
    readonly canal: string,
    mensagem: string,
    options?: { cause?: unknown },
  ) {
    super(`${canal}: ${mensagem}`, options);
    this.name = 'CanalFalhouError';
  }
}

export interface Logger {
  info(mensagem: string): void;
  aviso(mensagem: string): void;
  erro(mensagem: string): void;
}
