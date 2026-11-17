import { obterVigilancia, pedirChecagem } from '@frank/banco';
import { pedidoDoPainel } from '@/lib/servidor/origem';
import { banco } from '@/lib/servidor/recursos';
import { falha, ok, recusado } from '@/lib/servidor/resposta';
import { montarStatus } from '@/lib/status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/**
 * "Checar agora" (issue #26): grava o pedido; o vigia checa a rota no proximo tique (ate 1 min).
 * Nao consulta nada daqui: o vigia continua sendo o unico que gasta o teto diario.
 */
export async function POST(request: Request, { params }: Contexto) {
  if (!pedidoDoPainel(request.headers)) return recusado();
  const { id } = await params;
  const db = banco();
  const v = obterVigilancia(db, id);
  if (!v) return falha('Vigilância não encontrada.', 404);
  if (!v.ativa) return falha('Esta rota está pausada. Retome a rota para checar.', 409);
  pedirChecagem(db, id);
  return ok({ id, vigiaLigado: montarStatus(db).vigia.estado === 'ligado' });
}
