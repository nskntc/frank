import { criarVigilancia, jaViuVoo, listarVigilancias } from '@frank/banco';
import { novaVigilanciaSchema } from '@frank/contratos';
import { estimarConsultas, limitesDoAmbiente } from '@/lib/estimativa';
import { pedidoDoPainel } from '@/lib/servidor/origem';
import { banco } from '@/lib/servidor/recursos';
import { falha, ok, recusado } from '@/lib/servidor/resposta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * As vigilancias, com a estimativa de consultas por dia de cada uma junto com as outras ativas
 * (a pausada, como se fosse retomada).
 */
export async function GET(request: Request) {
  if (!pedidoDoPainel(request.headers)) return recusado();
  const db = banco();
  const todas = listarVigilancias(db);
  const ativas = todas.filter((v) => v.ativa);
  const limites = limitesDoAmbiente();
  const vigilancias = todas.map((v) => ({
    ...v,
    estimativa: estimarConsultas(
      v,
      ativas.filter((o) => o.id !== v.id),
      limites,
    ),
    jaAchouVoo: jaViuVoo(db, v.id),
  }));
  return ok(vigilancias);
}

/** Salva uma vigilancia que a pessoa ja confirmou (o plano vem de /api/vigilancias/planejar). */
export async function POST(request: Request) {
  if (!pedidoDoPainel(request.headers)) return recusado();
  const corpo = (await request.json().catch(() => null)) as { vigilancia?: unknown } | null;
  const validada = novaVigilanciaSchema.safeParse(corpo?.vigilancia);
  if (!validada.success) {
    return falha(
      'A vigilância está fora do formato.',
      400,
      validada.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    );
  }
  return ok(criarVigilancia(banco(), validada.data), 201);
}
