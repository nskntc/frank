import type { Vigilancia } from '@frank/contratos';
import { lerDia } from '@frank/dominio';
import type { ConsultaVoo } from '@frank/fontes';

/**
 * As buscas de uma vigilancia numa rodada: uma por par origem x destino, no primeiro dia da
 * janela de ida (e de volta). A divisao por companhia e por data da janela entra na issue #5.
 */
export function consultasDaVigilancia(v: Vigilancia): ConsultaVoo[] {
  const consultas: ConsultaVoo[] = [];
  for (const origem of v.origens) {
    for (const destino of v.destinos) {
      consultas.push({
        origem,
        destino,
        ida: lerDia(v.idaDe),
        ...(v.voltaDe ? { volta: lerDia(v.voltaDe) } : {}),
        adultos: v.adultos,
        malasDespachadas: v.malasDespachadas,
        ...(v.maxEscalas !== null ? { maxEscalas: v.maxEscalas } : {}),
        ...(v.companhias.length ? { companhias: v.companhias } : {}),
        aceitarPassagensSeparadas: v.aceitarPassagensSeparadas,
        moeda: v.moeda,
      });
    }
  }
  return consultas;
}
