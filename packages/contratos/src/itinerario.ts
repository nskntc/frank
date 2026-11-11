import { z } from 'zod';

/**
 * Itinerario no formato do Frank, igual para toda fonte. A fonte converte o que recebe para isto
 * e valida aqui; o resto do sistema nunca ve o formato cru de uma fonte.
 */

const codigoAeroporto = z.string().regex(/^[A-Z]{3}$/);

/** Horario local do aeroporto, sem fuso no texto: AAAA-MM-DDTHH:MM(:SS). */
const horarioLocal = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/);

/** Link de compra so https. `javascript:` ou `data:` vindo de fonte nunca chega ao painel. */
const linkHttps = z.url({ protocol: /^https$/ });

export const trechoSchema = z.object({
  de: codigoAeroporto,
  para: codigoAeroporto,
  partida: horarioLocal,
  chegada: horarioLocal,
  companhia: z.string().min(1),
  codigoCompanhia: z.string().min(2).max(3),
  numeroVoo: z.string().min(1),
});

export const pernaSchema = z.object({
  de: codigoAeroporto,
  para: codigoAeroporto,
  partida: horarioLocal,
  chegada: horarioLocal,
  duracaoSegundos: z.number().int().nonnegative(),
  escalas: z.number().int().nonnegative(),
  trechos: z.array(trechoSchema).min(1),
});

export const itinerarioSchema = z.object({
  fonte: z.string().min(1),
  idNaFonte: z.string().min(1),
  precoCentavos: z.number().int().nonnegative(),
  moeda: z.string().regex(/^[A-Z]{3}$/),
  linkCompra: linkHttps,
  malas: z.object({
    item: z.number().int().nonnegative(),
    mao: z.number().int().nonnegative(),
    despachada: z.number().int().nonnegative(),
  }),
  ida: pernaSchema,
  volta: pernaSchema.nullable(),
});

export type Trecho = z.infer<typeof trechoSchema>;
export type Perna = z.infer<typeof pernaSchema>;
export type Itinerario = z.infer<typeof itinerarioSchema>;
