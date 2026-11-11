import { z } from 'zod';

/**
 * Formato cru da ferramenta `search-flight` do MCP da Kiwi (lido em 2026-11-10).
 * So os campos que o Frank usa; o resto e ignorado.
 */
const segmentoKiwi = z.object({
  from: z.string(),
  to: z.string(),
  departureTime: z.string(),
  arrivalTime: z.string(),
  carrier: z.string(),
  carrierName: z.string(),
  flightNumber: z.string(),
});

const pernaKiwi = z.object({
  from: z.string(),
  to: z.string(),
  departureTime: z.string(),
  arrivalTime: z.string(),
  durationSeconds: z.number(),
  stops: z.number(),
  segments: z.array(segmentoKiwi),
});

export const itinerarioKiwi = z.object({
  id: z.string(),
  price: z.number(),
  bookingUrl: z.string(),
  baggage: z.object({
    personalItem: z.number(),
    cabinBag: z.number(),
    checkedBag: z.number(),
  }),
  outbound: pernaKiwi,
  inbound: pernaKiwi.optional().nullable(),
});

export const resultadoBuscaKiwi = z.object({
  currency: z.string(),
  resultsCount: z.number(),
  itineraries: z.array(itinerarioKiwi),
  error: z.string().nullable().optional(),
});

/** Envelope JSON-RPC do MCP: o resultado da ferramenta vem como texto JSON em content[0]. */
export const respostaRpcKiwi = z.object({
  jsonrpc: z.literal('2.0'),
  result: z
    .object({
      isError: z.boolean().optional(),
      content: z.array(z.object({ type: z.string(), text: z.string() })).min(1),
    })
    .optional(),
  error: z.object({ code: z.number(), message: z.string() }).optional(),
});

export type ItinerarioKiwi = z.infer<typeof itinerarioKiwi>;
