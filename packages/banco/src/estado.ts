import type { Banco } from './abrir.js';

/**
 * Estado do vigia, lido pela barra de status do painel (RF-19). Chaves conhecidas:
 * - `vigia_visto_em`: o vigia grava a cada tique; velho demais = vigia desligado ou travado
 * - `ultimo_erro_ciclo`: erro que impediu o ciclo inteiro (ex.: banco), vazio quando resolveu
 * - `teto:<fonte>`: instante em que a fonte bateu o teto de consultas em 24 h
 */
export const CHAVES_ESTADO = {
  vigiaVistoEm: 'vigia_visto_em',
  ultimoErroCiclo: 'ultimo_erro_ciclo',
  teto: (fonte: string) => `teto:${fonte}`,
} as const;

export function gravarEstado(db: Banco, chave: string, valor: string, agora: Date = new Date()): void {
  db.prepare(
    `INSERT INTO estado_vigia (chave, valor, atualizado_em) VALUES (?, ?, ?)
     ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em`,
  ).run(chave, valor, agora.toISOString());
}

export function apagarEstado(db: Banco, chave: string): void {
  db.prepare('DELETE FROM estado_vigia WHERE chave = ?').run(chave);
}

export interface ItemEstado {
  valor: string;
  atualizadoEm: string;
}

export function lerEstado(db: Banco, chave: string): ItemEstado | null {
  const linha = db
    .prepare('SELECT valor, atualizado_em FROM estado_vigia WHERE chave = ?')
    .get(chave) as { valor: string; atualizado_em: string } | undefined;
  return linha ? { valor: linha.valor, atualizadoEm: linha.atualizado_em } : null;
}
