/**
 * Dia de calendario no formato AAAA-MM-DD, sem hora e sem fuso.
 * Data de voo e sempre dia de calendario; horario de voo carrega o fuso do aeroporto.
 * Licao herdada do JN e do aupus-service: nada de `new Date('AAAA-MM-DD')` solto.
 */
export type Dia = string & { readonly __marca: 'Dia' };

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_POR_DIA = 86_400_000;

export class DiaInvalidoError extends Error {
  constructor(valor: string) {
    super(`Dia invalido: "${valor}". Use AAAA-MM-DD com uma data que exista.`);
    this.name = 'DiaInvalidoError';
  }
}

/** Valida e devolve o dia. Recusa 2026-02-30, 2026-13-01 e anos fora de 1900 a 2199. */
export function lerDia(valor: string): Dia {
  const partes = FORMATO.exec(valor);
  if (!partes) throw new DiaInvalidoError(valor);
  const [, anoTexto, mesTexto, diaTexto] = partes;
  const ano = Number(anoTexto);
  const mes = Number(mesTexto);
  const dia = Number(diaTexto);
  if (ano < 1900 || ano > 2199) throw new DiaInvalidoError(valor);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const existe =
    data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
  if (!existe) throw new DiaInvalidoError(valor);
  return valor as Dia;
}

function emDias(dia: Dia): number {
  return Date.parse(`${dia}T00:00:00Z`) / MS_POR_DIA;
}

/** Dias de `de` ate `ate` (negativo se `ate` vem antes). */
export function diasEntre(de: Dia, ate: Dia): number {
  return emDias(ate) - emDias(de);
}
