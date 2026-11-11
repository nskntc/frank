import { z } from 'zod';

/** Formato cru do Google Flights via SerpApi (lido em 2026-11-11). So os campos usados. */
const aeroporto = z.object({ id: z.string(), time: z.string() });

export const vooGoogle = z.object({
  departure_airport: aeroporto,
  arrival_airport: aeroporto,
  airline: z.string().optional(),
  flight_number: z.string(),
});

export const opcaoGoogle = z.object({
  flights: z.array(vooGoogle).min(1),
  price: z.number().optional(),
  departure_token: z.string().optional(),
  booking_token: z.string().optional(),
});

export const buscaGoogle = z.object({
  error: z.string().optional(),
  search_metadata: z.object({ google_flights_url: z.string().optional() }).optional(),
  best_flights: z.array(opcaoGoogle).optional(),
  other_flights: z.array(opcaoGoogle).optional(),
  price_insights: z
    .object({
      lowest_price: z.number().optional(),
      typical_price_range: z.tuple([z.number(), z.number()]).optional(),
      price_history: z.array(z.tuple([z.number(), z.number()])).optional(),
    })
    .optional(),
});

export const reservaGoogle = z.object({
  error: z.string().optional(),
  search_metadata: z.object({ google_flights_url: z.string().optional() }).optional(),
  booking_options: z
    .array(
      z.object({
        together: z
          .object({
            book_with: z.string(),
            airline: z.boolean().optional(),
            price: z.number().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

export type OpcaoGoogle = z.infer<typeof opcaoGoogle>;
export type BuscaGoogle = z.infer<typeof buscaGoogle>;
