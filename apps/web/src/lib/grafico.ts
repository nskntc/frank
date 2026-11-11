/**
 * Geometria do grafico de preco (sem React): escalas, marcas de eixo e ponto mais proximo. Fica
 * separada do componente para ter teste.
 */

export interface Escala {
  min: number;
  max: number;
  /** Valor -> pixel. */
  px: (v: number) => number;
}

export function escala(min: number, max: number, dePx: number, atePx: number): Escala {
  const faixa = max - min || 1;
  return { min, max, px: (v) => dePx + ((v - min) / faixa) * (atePx - dePx) };
}

/** Passo "redondo" (1, 2 ou 5 x 10^n) para cerca de `quantas` marcas entre min e max. */
function passoRedondo(min: number, max: number, quantas: number): number {
  const bruto = (max - min) / Math.max(1, quantas);
  if (bruto <= 0) return 1;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const fracao = bruto / potencia;
  return (fracao <= 1 ? 1 : fracao <= 2 ? 2 : fracao <= 5 ? 5 : 10) * potencia;
}

/**
 * Faixa do eixo de preco com folga e marcas redondas. Preco nao precisa comecar no zero numa
 * linha (o que importa e a variacao), mas nunca fica negativo.
 */
export function faixaDePreco(
  valores: readonly number[],
  quantas = 4,
): { min: number; max: number; marcas: number[] } {
  if (valores.length === 0) return { min: 0, max: 1, marcas: [] };
  let menor = Math.min(...valores);
  let maior = Math.max(...valores);
  if (menor === maior) {
    menor *= 0.9;
    maior *= 1.1;
  }
  const passo = passoRedondo(menor, maior, quantas);
  const min = Math.max(0, Math.floor(menor / passo) * passo);
  const max = Math.ceil(maior / passo) * passo;
  const marcas: number[] = [];
  for (let v = min; v <= max + passo / 2; v += passo) marcas.push(v);
  return { min, max, marcas };
}

/** Indice do ponto com `t` mais perto de `alvo` (lista em ordem de t). -1 se vazia. */
export function maisProximo(ts: readonly number[], alvo: number): number {
  if (ts.length === 0) return -1;
  let lo = 0;
  let hi = ts.length - 1;
  while (lo < hi) {
    const meio = (lo + hi) >> 1;
    if ((ts[meio] as number) < alvo) lo = meio + 1;
    else hi = meio;
  }
  const anterior = lo - 1;
  if (
    anterior >= 0 &&
    Math.abs((ts[anterior] as number) - alvo) <= Math.abs((ts[lo] as number) - alvo)
  )
    return anterior;
  return lo;
}

/**
 * Ate `quantas` marcas de tempo em dias inteiros, dentro de [min, max]. `deslocamentoMs` poe a
 * meia-noite no fuso da tela (Brasilia = 3 h depois da meia-noite UTC, sem horario de verao).
 */
export function marcasDeDias(
  min: number,
  max: number,
  quantas: number,
  deslocamentoMs = 0,
): number[] {
  const DIA = 86_400_000;
  const dias = Math.max(1, Math.ceil((max - min) / DIA));
  const passo = Math.max(1, Math.ceil(dias / Math.max(1, quantas)));
  const primeiro = Math.ceil((min - deslocamentoMs) / DIA) * DIA + deslocamentoMs;
  const marcas: number[] = [];
  for (let t = primeiro; t <= max; t += passo * DIA) marcas.push(t);
  return marcas;
}
