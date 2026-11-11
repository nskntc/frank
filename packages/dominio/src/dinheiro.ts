/** Dinheiro sempre em centavos inteiros. Float so existe na borda (resposta da fonte). */
export type Centavos = number;

export class ValorInvalidoError extends Error {
  constructor(valor: number) {
    super(`Valor invalido: ${valor}. Precisa ser um numero finito e nao negativo.`);
    this.name = 'ValorInvalidoError';
  }
}

/** Converte reais (como a fonte manda, ex.: 1092.0) em centavos inteiros. */
export function reaisParaCentavos(reais: number): Centavos {
  if (!Number.isFinite(reais) || reais < 0) throw new ValorInvalidoError(reais);
  return Math.round(reais * 100);
}

const formatoReais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 109200 -> "R$ 1.092,00" (espaco comum, nao o espaco fino que o Intl usa). */
export function formatarReais(centavos: Centavos): string {
  return formatoReais.format(centavos / 100).replace(/\s/g, ' ');
}
