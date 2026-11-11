import type { Centavos } from '@frank/dominio';
import { type Banco, idInserido } from './abrir.js';
import { type Oferta, obterOferta } from './ofertas.js';

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
 * Ofertas candidatas a aviso (RF-15): nao descartadas, detectadas desde `desde`. Quem decide o
 * que falta enviar, canal a canal, e `historicoAvisoCanal`. A mais nova primeiro: o preco atual
 * vem antes de um mais velho.
 * Inclui 'detectada': o vigia avalia antes de avisar no mesmo tique, entao uma oferta ainda
 * 'detectada' aqui e uma que perdeu a avaliacao (o vigia caiu no meio). Melhor avisar que calar.
 */
export function ofertasParaAvisar(db: Banco, desde: Date): Oferta[] {
  const ids = db
    .prepare(
      `SELECT id FROM ofertas WHERE status != 'descartada' AND detectada_em >= ?
       ORDER BY detectada_em DESC, id DESC`,
    )
    .all(desde.toISOString()) as unknown as { id: number }[];
  return ids.flatMap((l) => {
    const oferta = obterOferta(db, l.id);
    return oferta ? [oferta] : [];
  });
}

export interface HistoricoAvisoCanal {
  entregue: boolean;
  falhas: number;
  ultimaFalhaEm: string | null;
}

/** O que ja aconteceu com o aviso de uma oferta num canal: cada canal tem a sua fila. */
export function historicoAvisoCanal(db: Banco, ofertaId: number, canal: string): HistoricoAvisoCanal {
  const linha = db
    .prepare(
      `SELECT MAX(sucesso) AS entregue, SUM(CASE WHEN sucesso = 0 THEN 1 ELSE 0 END) AS falhas,
              MAX(CASE WHEN sucesso = 0 THEN enviado_em END) AS ultima_falha
       FROM alertas WHERE oferta_id = ? AND canal = ?`,
    )
    .get(ofertaId, canal) as { entregue: number | null; falhas: number | null; ultima_falha: string | null } | undefined;
  return {
    entregue: linha?.entregue === 1,
    falhas: linha?.falhas ?? 0,
    ultimaFalhaEm: linha?.ultima_falha ?? null,
  };
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
  /** Deixa de fora os avisos desta oferta (outro canal dela ainda pode estar pendente). */
  excetoOfertaId: number | null = null,
): Centavos | null {
  const linha = db
    .prepare(
      `SELECT MIN(preco_centavos) AS menor FROM alertas
       WHERE sucesso = 1 AND vigilancia_id = ? AND fonte = ? AND id_na_fonte = ? AND moeda = ?
         AND (? IS NULL OR oferta_id IS NULL OR oferta_id != ?)`,
    )
    .get(vigilanciaId, fonte, idNaFonte, moeda, excetoOfertaId, excetoOfertaId) as { menor: number | null } | undefined;
  return linha?.menor ?? null;
}
