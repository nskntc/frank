import { type Banco, idInserido } from './abrir.js';

export interface NovaChamadaIa {
  /** O que o Claude fez: 'planejar', 'avaliar_oferta'... */
  tarefa: string;
  sucesso: boolean;
  /** Mensagem curta, sem o texto do pedido, sem token, sem dado pessoal. */
  erro?: string | null;
  duracaoMs?: number | null;
}

/** Registra uma chamada ao Claude. Nunca recebe o texto do pedido nem da resposta. */
export function registrarChamadaIa(db: Banco, chamada: NovaChamadaIa, agora: Date = new Date()): number {
  return idInserido(
    db
      .prepare('INSERT INTO chamadas_ia (tarefa, em, sucesso, erro, duracao_ms) VALUES (?, ?, ?, ?, ?)')
      .run(
        chamada.tarefa,
        agora.toISOString(),
        chamada.sucesso ? 1 : 0,
        chamada.erro ?? null,
        chamada.duracaoMs ?? null,
      ),
  );
}

/** Chamadas (com sucesso ou nao) desde o instante: base do orcamento diario. */
export function contarChamadasIa(db: Banco, desde: Date): number {
  const linha = db
    .prepare('SELECT COUNT(*) AS total FROM chamadas_ia WHERE em >= ?')
    .get(desde.toISOString()) as { total: number } | undefined;
  return linha?.total ?? 0;
}

export interface EstadoIa {
  ultimaChamada: string | null;
  ultimoSucesso: string | null;
  /** Erro da ultima chamada, se ela falhou. */
  ultimoErro: string | null;
}

export function estadoIa(db: Banco): EstadoIa {
  const ultima = db
    .prepare('SELECT em, sucesso, erro FROM chamadas_ia ORDER BY em DESC, id DESC LIMIT 1')
    .get() as { em: string; sucesso: number; erro: string | null } | undefined;
  const sucesso = db.prepare('SELECT MAX(em) AS em FROM chamadas_ia WHERE sucesso = 1').get() as
    | { em: string | null }
    | undefined;
  return {
    ultimaChamada: ultima?.em ?? null,
    ultimoSucesso: sucesso?.em ?? null,
    ultimoErro: ultima && ultima.sucesso === 0 ? ultima.erro : null,
  };
}
