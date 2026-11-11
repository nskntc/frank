import type { Centavos } from './dinheiro.js';
import { mediana } from './estatistica.js';

/** Valores iniciais a calibrar com o diario de testes (SPEC-01, RF-07 e RF-08). */
export const DETECTOR_PADRAO = {
  minimoObservacoes: 20,
  percentualAbaixoDoNormal: 25,
  /** Janela do preco normal proprio (RF-07). */
  janelaNormalDias: 14,
  /** Referencia do Google: historico de ate 60 dias, valendo com pelo menos 10 dias. */
  janelaReferenciaDias: 60,
  minimoPontosReferencia: 10,
} as const;

/**
 * Preco normal da rota: mediana das observacoes. Uma observacao = o menor preco de uma rodada
 * do vigia (banco: `menoresPorRodada`), nunca cada itinerario. Abaixo do minimo devolve null, e o
 * detector usa so o preco-alvo (historico curto engana).
 */
export function precoNormal(
  historico: readonly Centavos[],
  minimoObservacoes: number = DETECTOR_PADRAO.minimoObservacoes,
): Centavos | null {
  if (historico.length < minimoObservacoes) return null;
  const valor = mediana(historico);
  return valor === null ? null : Math.round(valor);
}

export type MotivoOferta = 'abaixo_do_alvo' | 'abaixo_do_normal';

export interface EntradaDetector {
  /** O que a pessoa paga (com IOF e mala): comparado com o preco-alvo. */
  precoFinal: Centavos;
  /**
   * Preco comparado com o preco normal. Padrao: `precoFinal`. Use o preco da fonte quando o
   * historico tambem e da fonte (sem IOF): assim a comparacao e entre iguais.
   */
  precoParaNormal?: Centavos;
  precoAlvo?: Centavos | null;
  precoNormal?: Centavos | null;
  percentualAbaixoDoNormal?: number;
}

export interface ResultadoDetector {
  ehOferta: boolean;
  motivos: MotivoOferta[];
  /** Quanto o preco esta abaixo do normal, em %, arredondado. Null sem preco normal. */
  percentualAbaixo: number | null;
}

export function detectarOferta(entrada: EntradaDetector): ResultadoDetector {
  const limite = entrada.percentualAbaixoDoNormal ?? DETECTOR_PADRAO.percentualAbaixoDoNormal;
  const motivos: MotivoOferta[] = [];

  if (entrada.precoAlvo != null && entrada.precoFinal <= entrada.precoAlvo) {
    motivos.push('abaixo_do_alvo');
  }

  let percentualAbaixo: number | null = null;
  if (entrada.precoNormal != null && entrada.precoNormal > 0) {
    const comparado = entrada.precoParaNormal ?? entrada.precoFinal;
    // Compara em inteiros, sem arredondar: 24,6% abaixo nao pode virar "25%" e passar.
    if (comparado * 100 <= entrada.precoNormal * (100 - limite)) motivos.push('abaixo_do_normal');
    // Arredondado so para mostrar.
    percentualAbaixo = Math.round((1 - comparado / entrada.precoNormal) * 100);
  }

  return { ehOferta: motivos.length > 0, motivos, percentualAbaixo };
}
