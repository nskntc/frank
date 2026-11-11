/**
 * Logger minimo do vigia: uma linha por evento, com hora ISO e nivel.
 * Nunca recebe token ou dado pessoal (regra do repo publico).
 */
export type Nivel = 'info' | 'aviso' | 'erro';

export interface Logger {
  info(mensagem: string): void;
  aviso(mensagem: string): void;
  erro(mensagem: string): void;
}

export function formatarLinha(nivel: Nivel, mensagem: string, agora: Date = new Date()): string {
  return `${agora.toISOString()} [${nivel}] ${mensagem}`;
}

export const log: Logger = {
  info(mensagem) {
    process.stdout.write(`${formatarLinha('info', mensagem)}\n`);
  },
  aviso(mensagem) {
    process.stderr.write(`${formatarLinha('aviso', mensagem)}\n`);
  },
  erro(mensagem) {
    process.stderr.write(`${formatarLinha('erro', mensagem)}\n`);
  },
};
