import type { Banco } from './abrir.js';

/**
 * Configuracoes da pessoa, editadas na tela de Configuracoes (RF-19). Cada uma com valor padrao:
 * banco vazio funciona. Valores guardados como texto e convertidos na leitura.
 */
export const CONFIGURACOES = {
  /** "Pago ate X% a mais para comprar direto na companhia" (RF-14). */
  toleranciaCompanhiaPct: { chave: 'tolerancia_companhia_pct', padrao: 5, min: 0, max: 50 },
} as const;

type Numerica = (typeof CONFIGURACOES)[keyof typeof CONFIGURACOES];

export function lerConfiguracaoNumero(db: Banco, config: Numerica): number {
  const linha = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get(config.chave) as
    | { valor: string }
    | undefined;
  // Vazio nao e zero: Number('') daria 0 e esconderia o padrao.
  const n = linha && linha.valor.trim() !== '' ? Number(linha.valor) : Number.NaN;
  // Valor estranho no banco (editado a mao, versao antiga) volta ao padrao, nunca quebra a tela.
  return Number.isFinite(n) && n >= config.min && n <= config.max ? n : config.padrao;
}

export class ConfiguracaoInvalidaError extends Error {
  constructor(chave: string, min: number, max: number) {
    super(`${chave} precisa ser um número entre ${min} e ${max}.`);
    this.name = 'ConfiguracaoInvalidaError';
  }
}

export function gravarConfiguracaoNumero(db: Banco, config: Numerica, valor: number, agora: Date = new Date()): void {
  if (!Number.isFinite(valor) || valor < config.min || valor > config.max) {
    throw new ConfiguracaoInvalidaError(config.chave, config.min, config.max);
  }
  db.prepare(
    `INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES (?, ?, ?)
     ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em`,
  ).run(config.chave, String(valor), agora.toISOString());
}
