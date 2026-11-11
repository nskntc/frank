import { type AvaliacaoOferta, avaliacaoOfertaSchema } from '@frank/contratos';
import type { Centavos, MotivoOferta } from '@frank/dominio';
import { type Banco, emTransacao, idInserido } from './abrir.js';

export type StatusOferta = 'detectada' | 'avaliada' | 'sem_avaliacao' | 'descartada';

export interface Oferta {
  id: number;
  vigilanciaId: string;
  precoVistoId: number;
  precoFinalCentavos: Centavos;
  moeda: string;
  precoNormalCentavos: Centavos | null;
  percentualAbaixo: number | null;
  motivos: MotivoOferta[];
  status: StatusOferta;
  /** Null sem avaliacao, ou quando o JSON gravado nao bate mais com o contrato atual. */
  avaliacao: AvaliacaoOferta | null;
  detectadaEm: string;
  reconferidaEm: string | null;
}

export interface NovaOferta {
  vigilanciaId: string;
  precoVistoId: number;
  precoFinalCentavos: Centavos;
  moeda: string;
  precoNormalCentavos: Centavos | null;
  percentualAbaixo: number | null;
  motivos: MotivoOferta[];
}

interface LinhaOferta {
  id: number;
  vigilancia_id: string;
  preco_visto_id: number;
  preco_final_centavos: number;
  moeda: string;
  preco_normal_centavos: number | null;
  percentual_abaixo: number | null;
  motivos: string;
  status: StatusOferta;
  avaliacao: string | null;
  detectada_em: string;
  reconferida_em: string | null;
}

function lerAvaliacao(json: string | null): AvaliacaoOferta | null {
  if (!json) return null;
  try {
    const r = avaliacaoOfertaSchema.safeParse(JSON.parse(json));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

function paraOferta(l: LinhaOferta): Oferta {
  return {
    id: l.id,
    vigilanciaId: l.vigilancia_id,
    precoVistoId: l.preco_visto_id,
    precoFinalCentavos: l.preco_final_centavos,
    moeda: l.moeda,
    precoNormalCentavos: l.preco_normal_centavos,
    percentualAbaixo: l.percentual_abaixo,
    motivos: JSON.parse(l.motivos) as MotivoOferta[],
    status: l.status,
    avaliacao: lerAvaliacao(l.avaliacao),
    detectadaEm: l.detectada_em,
    reconferidaEm: l.reconferida_em,
  };
}

export function registrarOferta(db: Banco, nova: NovaOferta, agora: Date = new Date()): Oferta {
  const r = db
    .prepare(
      `INSERT INTO ofertas (vigilancia_id, preco_visto_id, preco_final_centavos, moeda,
         preco_normal_centavos, percentual_abaixo, motivos, status, detectada_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'detectada', ?)`,
    )
    .run(
      nova.vigilanciaId,
      nova.precoVistoId,
      nova.precoFinalCentavos,
      nova.moeda,
      nova.precoNormalCentavos,
      nova.percentualAbaixo,
      JSON.stringify(nova.motivos),
      agora.toISOString(),
    );
  return obterOferta(db, idInserido(r)) as Oferta;
}

export function obterOferta(db: Banco, id: number): Oferta | null {
  const linha = db.prepare('SELECT * FROM ofertas WHERE id = ?').get(id) as LinhaOferta | undefined;
  return linha ? paraOferta(linha) : null;
}

export function marcarReconferida(db: Banco, id: number, agora: Date = new Date()): void {
  db.prepare('UPDATE ofertas SET reconferida_em = ? WHERE id = ?').run(agora.toISOString(), id);
}

/** Guarda a avaliacao do Claude (validada pelo schema) ou marca "sem avaliacao" (RF-11). */
export function salvarAvaliacao(db: Banco, id: number, avaliacao: AvaliacaoOferta | null): void {
  if (avaliacao === null) {
    db.prepare(`UPDATE ofertas SET status = 'sem_avaliacao' WHERE id = ?`).run(id);
    return;
  }
  const valida = avaliacaoOfertaSchema.parse(avaliacao);
  db.prepare(`UPDATE ofertas SET status = 'avaliada', avaliacao = ? WHERE id = ?`).run(
    JSON.stringify(valida),
    id,
  );
}

export function descartarOferta(db: Banco, id: number): void {
  db.prepare(`UPDATE ofertas SET status = 'descartada' WHERE id = ?`).run(id);
}

/** Ofertas para o painel: da mais barata para a mais cara, sem as descartadas. */
export function listarOfertas(db: Banco, filtro: { vigilanciaId?: string } = {}): Oferta[] {
  const linhas = (
    filtro.vigilanciaId
      ? db
          .prepare(
            `SELECT * FROM ofertas WHERE status != 'descartada' AND vigilancia_id = ?
             ORDER BY preco_final_centavos, detectada_em DESC`,
          )
          .all(filtro.vigilanciaId)
      : db
          .prepare(
            `SELECT * FROM ofertas WHERE status != 'descartada'
             ORDER BY preco_final_centavos, detectada_em DESC`,
          )
          .all()
  ) as unknown as LinhaOferta[];
  return linhas.map(paraOferta);
}

export interface OpcaoCompra {
  vendedor: string;
  precoCentavos: Centavos;
  moeda: string;
  /** Vendedor estrangeiro: IOF de 3,5% no cartao (preco-final.ts). */
  estrangeiro: boolean;
  link: string | null;
}

/** Substitui as opcoes de compra da oferta pelas da consulta mais recente. */
export function salvarOpcoesCompra(db: Banco, ofertaId: number, opcoes: readonly OpcaoCompra[]): void {
  const inserir = db.prepare(
    `INSERT INTO opcoes_compra (oferta_id, vendedor, preco_centavos, moeda, estrangeiro, link)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  emTransacao(db, () => {
    db.prepare('DELETE FROM opcoes_compra WHERE oferta_id = ?').run(ofertaId);
    for (const o of opcoes) {
      inserir.run(ofertaId, o.vendedor, o.precoCentavos, o.moeda, o.estrangeiro ? 1 : 0, o.link);
    }
  });
}

export function listarOpcoesCompra(db: Banco, ofertaId: number): OpcaoCompra[] {
  const linhas = db
    .prepare(
      `SELECT vendedor, preco_centavos, moeda, estrangeiro, link FROM opcoes_compra
       WHERE oferta_id = ? ORDER BY preco_centavos`,
    )
    .all(ofertaId) as unknown as {
    vendedor: string;
    preco_centavos: number;
    moeda: string;
    estrangeiro: number;
    link: string | null;
  }[];
  return linhas.map((l) => ({
    vendedor: l.vendedor,
    precoCentavos: l.preco_centavos,
    moeda: l.moeda,
    estrangeiro: l.estrangeiro === 1,
    link: l.link,
  }));
}
