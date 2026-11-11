import { type Itinerario, itinerarioSchema } from '@frank/contratos';
import type { Centavos } from '@frank/dominio';
import { type Banco, emTransacao, idInserido } from './abrir.js';

export interface PrecoVisto {
  id: number;
  vigilanciaId: string;
  rodada: string;
  fonte: string;
  idNaFonte: string;
  vistoEm: string;
  precoCentavos: Centavos;
  moeda: string;
  /**
   * Null quando o JSON gravado nao bate mais com o contrato atual (versao antiga do Frank).
   * Uma linha antiga nunca derruba a tela; preco e moeda continuam valendo.
   */
  itinerario: Itinerario | null;
}

interface LinhaPrecoVisto {
  id: number;
  vigilancia_id: string;
  rodada: string;
  fonte: string;
  id_na_fonte: string;
  visto_em: string;
  preco_centavos: number;
  moeda: string;
  itinerario: string;
}

function lerItinerario(json: string): Itinerario | null {
  try {
    const r = itinerarioSchema.safeParse(JSON.parse(json));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

function paraPrecoVisto(l: LinhaPrecoVisto): PrecoVisto {
  return {
    id: l.id,
    vigilanciaId: l.vigilancia_id,
    rodada: l.rodada,
    fonte: l.fonte,
    idNaFonte: l.id_na_fonte,
    vistoEm: l.visto_em,
    precoCentavos: l.preco_centavos,
    moeda: l.moeda,
    itinerario: lerItinerario(l.itinerario),
  };
}

/**
 * Grava os itinerarios de uma busca (tudo ou nada, validados na escrita). `rodada` identifica o
 * ciclo do vigia: todas as buscas de uma vigilancia no mesmo ciclo (companhias, aeroportos,
 * fontes) usam a mesma rodada. Devolve os ids.
 */
export function registrarPrecosVistos(
  db: Banco,
  vigilanciaId: string,
  rodada: string,
  itinerarios: readonly Itinerario[],
  vistoEm: Date = new Date(),
): number[] {
  const inserir = db.prepare(
    `INSERT INTO precos_vistos (vigilancia_id, rodada, fonte, id_na_fonte, visto_em, preco_centavos,
       moeda, itinerario)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const instante = vistoEm.toISOString();
  return emTransacao(db, () =>
    itinerarios.map((it) => {
      const valido = itinerarioSchema.parse(it);
      return idInserido(
        inserir.run(
          vigilanciaId,
          rodada,
          valido.fonte,
          valido.idNaFonte,
          instante,
          valido.precoCentavos,
          valido.moeda,
          JSON.stringify(valido),
        ),
      );
    }),
  );
}

export function obterPrecoVisto(db: Banco, id: number): PrecoVisto | null {
  const linha = db.prepare('SELECT * FROM precos_vistos WHERE id = ?').get(id) as
    | LinhaPrecoVisto
    | undefined;
  return linha ? paraPrecoVisto(linha) : null;
}

/**
 * Base do preco normal (RF-07): o MENOR preco de cada rodada, da mais antiga para a mais nova,
 * desde `desde` e nunca antes do `historico_desde` da vigilancia. Uma rodada = uma observacao:
 * as dezenas de itinerarios de um ciclo nao inflam a contagem nem puxam a mediana para cima.
 * Moeda explicita: preco em EUR nunca entra na mediana de BRL.
 */
export function menoresPorRodada(
  db: Banco,
  vigilanciaId: string,
  desde: Date,
  moeda: string,
): Centavos[] {
  const linhas = db
    .prepare(
      `SELECT MIN(p.preco_centavos) AS menor
       FROM precos_vistos p
       JOIN vigilancias v ON v.id = p.vigilancia_id
       WHERE p.vigilancia_id = ? AND p.moeda = ?
         AND p.visto_em >= MAX(?, v.historico_desde)
       GROUP BY p.rodada
       ORDER BY MIN(p.visto_em)`,
    )
    .all(vigilanciaId, moeda, desde.toISOString()) as unknown as { menor: number }[];
  return linhas.map((l) => l.menor);
}

/** Todos os itinerarios da rodada mais recente da vigilancia, do mais barato ao mais caro. */
export function ultimaRodada(db: Banco, vigilanciaId: string): PrecoVisto[] {
  const linhas = db
    .prepare(
      `SELECT * FROM precos_vistos
       WHERE vigilancia_id = ?
         AND rodada = (SELECT rodada FROM precos_vistos WHERE vigilancia_id = ?
                       ORDER BY visto_em DESC, id DESC LIMIT 1)
       ORDER BY preco_centavos`,
    )
    .all(vigilanciaId, vigilanciaId) as unknown as LinhaPrecoVisto[];
  return linhas.map(paraPrecoVisto);
}

export interface ReferenciaPreco {
  dia: string;
  precoCentavos: Centavos;
}

/**
 * Historico de referencia vindo de fora (ex.: 60 dias do Google Flights via SerpApi). Regravar
 * o mesmo dia da mesma fonte substitui o valor.
 */
export function salvarReferencias(
  db: Banco,
  vigilanciaId: string,
  fonte: string,
  moeda: string,
  pontos: readonly ReferenciaPreco[],
  buscadoEm: Date = new Date(),
): void {
  const gravar = db.prepare(
    `INSERT INTO referencias_preco (vigilancia_id, fonte, dia, preco_centavos, moeda, buscado_em)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (vigilancia_id, fonte, dia)
     DO UPDATE SET preco_centavos = excluded.preco_centavos, moeda = excluded.moeda,
                   buscado_em = excluded.buscado_em`,
  );
  const instante = buscadoEm.toISOString();
  emTransacao(db, () => {
    for (const p of pontos) gravar.run(vigilanciaId, fonte, p.dia, p.precoCentavos, moeda, instante);
  });
}

export function listarReferencias(
  db: Banco,
  vigilanciaId: string,
  moeda: string,
): (ReferenciaPreco & { fonte: string })[] {
  const linhas = db
    .prepare(
      `SELECT fonte, dia, preco_centavos FROM referencias_preco
       WHERE vigilancia_id = ? AND moeda = ? ORDER BY dia`,
    )
    .all(vigilanciaId, moeda) as unknown as { fonte: string; dia: string; preco_centavos: number }[];
  return linhas.map((l) => ({ fonte: l.fonte, dia: l.dia, precoCentavos: l.preco_centavos }));
}
