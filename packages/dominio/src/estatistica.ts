/** Mediana de uma lista; null quando a lista esta vazia. Nao altera a lista recebida. */
export function mediana(valores: readonly number[]): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  const centro = ordenados[meio] as number;
  if (ordenados.length % 2 === 1) return centro;
  return ((ordenados[meio - 1] as number) + centro) / 2;
}
