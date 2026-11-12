import { obterVigilancia, registrarPlacar } from '@frank/banco';
import { reaisParaCentavos } from '@frank/dominio';
import { z } from 'zod';
import { instanteDeBrasilia } from '@/lib/placar';
import { pedidoDoPainel } from '@/lib/servidor/origem';
import { banco } from '@/lib/servidor/recursos';
import { falha, ok, recusado } from '@/lib/servidor/resposta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const alertaGoogleSchema = z
  .object({
    vigilanciaId: z.string().min(1).max(100),
    /** Data e hora em que o e-mail do Google chegou, no horario de Brasilia. */
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    hora: z.string().regex(/^\d{2}:\d{2}$/),
    precoReais: z.number().positive().max(1_000_000),
    confirmado: z.boolean(),
    observacao: z.string().trim().max(300).nullable(),
  })
  .strict();

/** Registra a mao um alerta de preco do Google Flights (RF-20). */
export async function POST(request: Request) {
  if (!pedidoDoPainel(request.headers)) return recusado();
  const corpo = await request.json().catch(() => null);
  const r = alertaGoogleSchema.safeParse(corpo);
  if (!r.success) {
    return falha(
      'O alerta está fora do formato.',
      400,
      r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    );
  }
  const vistoEm = instanteDeBrasilia(r.data.data, r.data.hora);
  if (!vistoEm) return falha('Essa data ou hora não existe.', 400);
  if (vistoEm.getTime() > Date.now() + 5 * 60_000)
    return falha('A hora do alerta está no futuro. Confira a data.', 400);
  const db = banco();
  const vigilancia = obterVigilancia(db, r.data.vigilanciaId);
  if (!vigilancia) return falha('Vigilância não encontrada.', 404);
  const id = registrarPlacar(db, {
    vigilanciaId: vigilancia.id,
    quem: 'google',
    vistoEm,
    precoCentavos: reaisParaCentavos(r.data.precoReais),
    moeda: vigilancia.moeda,
    confirmado: r.data.confirmado,
    observacao: r.data.observacao || null,
  });
  return ok({ id }, 201);
}
