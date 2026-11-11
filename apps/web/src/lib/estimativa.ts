import type { NovaVigilancia } from '@frank/contratos';

/** Ate quantas buscas por par de aeroportos o vigia faz por rodada (busca adaptativa, issue #5). */
export const BUSCAS_POR_PAR = 3;
/** Teto diario de consultas a fonte (FRANK_TETO_DIARIO_FONTE, padrao 300). */
export const TETO_DIARIO_PADRAO = 300;

export interface Estimativa {
  pares: number;
  /** Pior caso: todas as buscas extras de todos os pares, em todas as rodadas do dia. */
  consultasPorDia: number;
  cabeNoTeto: boolean;
}

/**
 * Quantas consultas por dia a vigilancia gasta no pior caso (issue #19): pares origem x destino,
 * vezes as buscas por par, vezes as rodadas do dia. Mostrado antes de salvar.
 */
export function estimarConsultas(v: Pick<NovaVigilancia, 'origens' | 'destinos' | 'intervaloMinutos' | 'companhias'>, teto = TETO_DIARIO_PADRAO): Estimativa {
  const pares = v.origens.length * v.destinos.length;
  const buscas = v.companhias.length ? 1 : BUSCAS_POR_PAR;
  const rodadas = Math.ceil((24 * 60) / v.intervaloMinutos);
  const consultasPorDia = pares * buscas * rodadas;
  return { pares, consultasPorDia, cabeNoTeto: consultasPorDia <= teto };
}
