import { z } from 'zod';
import type { Itinerario } from './itinerario.js';

/**
 * Quantas noites a pessoa quer ficar no destino (issue #24). Requisito, nao preferencia: as janelas
 * de ida e de volta sozinhas deixam combinar ida no dia 11 com volta 33 noites depois.
 */
export const estadiaSchema = z
  .object({
    minNoites: z.number().int().min(0).max(90),
    maxNoites: z.number().int().min(0).max(90),
  })
  .strict()
  .refine((e) => e.minNoites <= e.maxNoites, {
    message: 'minNoites maior que maxNoites',
    path: ['maxNoites'],
  });

export type Estadia = z.infer<typeof estadiaSchema>;

/**
 * Noites no destino: do dia em que a ida chega ao dia em que a volta sai (datas locais, como a
 * Kiwi conta). Null para so ida.
 */
export function noitesNoDestino(it: Itinerario): number | null {
  if (!it.volta) return null;
  const chega = Date.parse(`${it.ida.chegada.slice(0, 10)}T00:00:00Z`);
  const sai = Date.parse(`${it.volta.partida.slice(0, 10)}T00:00:00Z`);
  return Math.round((sai - chega) / 86_400_000);
}

/** O voo respeita a estadia pedida? Sem estadia, sempre. */
export function cabeNaEstadia(it: Itinerario, e: Estadia | null | undefined): boolean {
  if (!e) return true;
  const n = noitesNoDestino(it);
  return n === null || (n >= e.minNoites && n <= e.maxNoites);
}

/** "de 10 a 14 noites", "7 noites". */
export function descreverEstadia(e: Estadia | null | undefined): string | null {
  if (!e) return null;
  const n = (x: number) => (x === 1 ? '1 noite' : `${x} noites`);
  return e.minNoites === e.maxNoites ? n(e.minNoites) : `de ${e.minNoites} a ${n(e.maxNoites)}`;
}
