import type { Itinerario, Vigilancia } from '@frank/contratos';
import { lerDia } from '@frank/dominio';
import type { ConsultaVoo } from '@frank/fontes';

/**
 * As buscas-base de uma vigilancia numa rodada: uma por par origem x destino, com a janela de
 * datas inteira (a Kiwi aceita intervalo de ida e de volta numa busca so). A divisao por
 * companhia acontece na rodada, conforme a resposta (`proximaExclusao`).
 */
export function consultasDaVigilancia(v: Vigilancia): ConsultaVoo[] {
  const consultas: ConsultaVoo[] = [];
  for (const origem of v.origens) {
    for (const destino of v.destinos) {
      consultas.push({
        origem,
        destino,
        ida: lerDia(v.idaDe),
        ...(v.idaAte !== v.idaDe ? { idaAte: lerDia(v.idaAte) } : {}),
        ...(v.voltaDe ? { volta: lerDia(v.voltaDe) } : {}),
        ...(v.voltaDe && v.voltaAte && v.voltaAte !== v.voltaDe ? { voltaAte: lerDia(v.voltaAte) } : {}),
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

/** Codigos das companhias que aparecem em qualquer trecho, ida ou volta, sem repetir. */
export function companhiasDoResultado(itinerarios: readonly Itinerario[]): string[] {
  const codigos = new Set<string>();
  for (const it of itinerarios) {
    for (const perna of [it.ida, it.volta]) {
      for (const trecho of perna?.trechos ?? []) codigos.add(trecho.codigoCompanhia);
    }
  }
  return [...codigos].sort();
}

/**
 * Depois de uma resposta, vale buscar de novo? So se a resposta veio cheia (a fonte pode ter
 * escondido voos de outras companhias) e trouxe alguma companhia ainda nao excluida. Devolve a
 * nova lista de exclusao, ou null para parar.
 */
export function proximaExclusao(
  itinerarios: readonly Itinerario[],
  limiteResultados: number | undefined,
  jaExcluidas: readonly string[],
): string[] | null {
  if (limiteResultados === undefined || itinerarios.length < limiteResultados) return null;
  const novas = companhiasDoResultado(itinerarios).filter((c) => !jaExcluidas.includes(c));
  return novas.length ? [...jaExcluidas, ...novas] : null;
}
