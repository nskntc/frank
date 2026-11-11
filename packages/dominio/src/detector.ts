import type { Centavos } from './dinheiro.js';
import { mediana } from './estatistica.js';

/** Valores iniciais a calibrar com o diario de testes (SPEC-01, RF-07 e RF-08). */
export const DETECTOR_PADRAO = {
  minimoObservacoes: 20,
  percentualAbaixoDoNormal: 25,
} as const;

/**
 * Preco normal da rota: mediana dos precos vistos. Abaixo do minimo de observacoes
 * devolve null, e o detector usa so o preco-alvo (historico curto engana).
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
  precoFinal: Centavos;
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
    percentualAbaixo = Math.round((1 - entrada.precoFinal / entrada.precoNormal) * 100);
    if (percentualAbaixo >= limite) motivos.push('abaixo_do_normal');
  }

  return { ehOferta: motivos.length > 0, motivos, percentualAbaixo };
}
