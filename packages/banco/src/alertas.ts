import type { Centavos } from '@frank/dominio';
import { type Banco, idInserido } from './abrir.js';

export interface NovoAlerta {
  vigilanciaId: string;
  /** A oferta que gerou o aviso. Se a oferta for apagada, o alerta continua (RF-16). */
  ofertaId: number | null;
  fonte: string;
  idNaFonte: string;
  canal: string;
  precoCentavos: Centavos;
  moeda: string;
  sucesso: boolean;
  /** Mensagem curta do erro, sem token nem dado pessoal. */
  erro?: string | null;
}

export function registrarAlerta(db: Banco, alerta: NovoAlerta, agora: Date = new Date()): number {
  return idInserido(
    db
      .prepare(
        `INSERT INTO alertas (vigilancia_id, oferta_id, fonte, id_na_fonte, canal, enviado_em,
           preco_centavos, moeda, sucesso, erro)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        alerta.vigilanciaId,
        alerta.ofertaId,
        alerta.fonte,
        alerta.idNaFonte,
        alerta.canal,
        agora.toISOString(),
        alerta.precoCentavos,
        alerta.moeda,
        alerta.sucesso ? 1 : 0,
        alerta.erro ?? null,
      ),
  );
}

/**
 * Menor preco ja avisado com sucesso para o mesmo itinerario (fonte + id na fonte), na mesma
 * moeda, da vigilancia. RF-16: so avisa de novo se o preco novo for menor. Null = nunca avisado.
 */
export function menorPrecoJaAvisado(
  db: Banco,
  vigilanciaId: string,
  fonte: string,
  idNaFonte: string,
  moeda: string,
): Centavos | null {
  const linha = db
    .prepare(
      `SELECT MIN(preco_centavos) AS menor FROM alertas
       WHERE sucesso = 1 AND vigilancia_id = ? AND fonte = ? AND id_na_fonte = ? AND moeda = ?`,
    )
    .get(vigilanciaId, fonte, idNaFonte, moeda) as { menor: number | null } | undefined;
  return linha?.menor ?? null;
}
