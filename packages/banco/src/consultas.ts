import { type Banco, idInserido } from './abrir.js';

/**
 * Registro de cada consulta a uma fonte (Kiwi, SerpApi). Serve para o teto diario/mensal
 * (RF-04, RF-13) e para a barra de status do painel (RF-19).
 */
export function registrarConsulta(
  db: Banco,
  fonte: string,
  resultado: { sucesso: boolean; erro?: string | null },
  agora: Date = new Date(),
): number {
  return idInserido(
    db
      .prepare('INSERT INTO consultas_fonte (fonte, em, sucesso, erro) VALUES (?, ?, ?, ?)')
      .run(fonte, agora.toISOString(), resultado.sucesso ? 1 : 0, resultado.erro ?? null),
  );
}

/** Quantas consultas (com sucesso ou nao) a fonte recebeu desde o instante. */
export function contarConsultas(db: Banco, fonte: string, desde: Date): number {
  const linha = db
    .prepare('SELECT COUNT(*) AS total FROM consultas_fonte WHERE fonte = ? AND em >= ?')
    .get(fonte, desde.toISOString()) as { total: number } | undefined;
  return linha?.total ?? 0;
}

export interface EstadoFonte {
  fonte: string;
  ultimaConsulta: string | null;
  ultimoSucesso: string | null;
  /** Erro da ultima consulta, se ela falhou. */
  ultimoErro: string | null;
}

export function estadoFonte(db: Banco, fonte: string): EstadoFonte {
  const ultima = db
    .prepare('SELECT em, sucesso, erro FROM consultas_fonte WHERE fonte = ? ORDER BY em DESC, id DESC LIMIT 1')
    .get(fonte) as { em: string; sucesso: number; erro: string | null } | undefined;
  const sucesso = db
    .prepare('SELECT MAX(em) AS em FROM consultas_fonte WHERE fonte = ? AND sucesso = 1')
    .get(fonte) as { em: string | null } | undefined;
  return {
    fonte,
    ultimaConsulta: ultima?.em ?? null,
    ultimoSucesso: sucesso?.em ?? null,
    ultimoErro: ultima && ultima.sucesso === 0 ? ultima.erro : null,
  };
}
