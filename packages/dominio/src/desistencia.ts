import { type Dia, diasEntre } from './dia.js';

/** ANAC, Resolucao 400, art. 11: 24 h para desistir sem custo se a compra for 7+ dias antes do voo. */
export const ANTECEDENCIA_MINIMA_DIAS = 7;

export interface Desistencia24h {
  vale: boolean;
  diasDeAntecedencia: number;
}

/**
 * A regra das 24 h vale para esta compra? Conta os dias de calendario entre a compra e o
 * embarque. Ha decisoes aplicando os 7 dias do CDC a compras online; aqui fica so a regra da ANAC.
 */
export function desistencia24h(diaCompra: Dia, diaEmbarque: Dia): Desistencia24h {
  const diasDeAntecedencia = diasEntre(diaCompra, diaEmbarque);
  return { vale: diasDeAntecedencia >= ANTECEDENCIA_MINIMA_DIAS, diasDeAntecedencia };
}
