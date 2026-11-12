import type { Centavos } from '@frank/dominio';
import { type Banco, idInserido } from './abrir.js';

export type Competidor = 'frank' | 'google';

export interface RegistroPlacar {
  id: number;
  vigilanciaId: string;
  quem: Competidor;
  /** Instante ISO em UTC em que o aviso chegou (para o Google: hora de chegada do e-mail). */
  vistoEm: string;
  precoCentavos: Centavos;
  moeda: string;
  /** Preco conferido ate a tela de pagamento. */
  confirmado: boolean;
  observacao: string | null;
}

export interface NovoRegistroPlacar {
  vigilanciaId: string;
  quem: Competidor;
  /** Recebe Date e grava em UTC: hora com fuso (ex.: -03:00) nunca e comparada como texto. */
  vistoEm: Date;
  precoCentavos: Centavos;
  moeda: string;
  confirmado: boolean;
  observacao: string | null;
}

export function registrarPlacar(db: Banco, registro: NovoRegistroPlacar): number {
  if (Number.isNaN(registro.vistoEm.getTime())) throw new RangeError('vistoEm invalido');
  return idInserido(
    db
      .prepare(
        `INSERT INTO placar (vigilancia_id, quem, visto_em, preco_centavos, moeda, confirmado, observacao)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        registro.vigilanciaId,
        registro.quem,
        registro.vistoEm.toISOString(),
        registro.precoCentavos,
        registro.moeda,
        registro.confirmado ? 1 : 0,
        registro.observacao,
      ),
  );
}

export function listarPlacar(db: Banco, vigilanciaId: string): RegistroPlacar[] {
  const linhas = db
    .prepare('SELECT * FROM placar WHERE vigilancia_id = ? ORDER BY visto_em, id')
    .all(vigilanciaId) as unknown as {
    id: number;
    vigilancia_id: string;
    quem: Competidor;
    visto_em: string;
    preco_centavos: number;
    moeda: string;
    confirmado: number;
    observacao: string | null;
  }[];
  return linhas.map((l) => ({
    id: l.id,
    vigilanciaId: l.vigilancia_id,
    quem: l.quem,
    vistoEm: l.visto_em,
    precoCentavos: l.preco_centavos,
    moeda: l.moeda,
    confirmado: l.confirmado === 1,
    observacao: l.observacao,
  }));
}

/** Apaga um registro feito a mao (ex.: digitado errado). False se nao existia. */
export function apagarPlacar(db: Banco, id: number): boolean {
  return Number(db.prepare('DELETE FROM placar WHERE id = ?').run(id).changes) > 0;
}
