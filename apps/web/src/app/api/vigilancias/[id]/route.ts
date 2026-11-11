import { apagarVigilancia, atualizarVigilancia, definirAtiva } from '@frank/banco';
import { novaVigilanciaSchema } from '@frank/contratos';
import { pedidoDoPainel } from '@/lib/servidor/origem';
import { banco } from '@/lib/servidor/recursos';
import { falha, ok, recusado } from '@/lib/servidor/resposta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** Pausar ou retomar: { ativa: boolean }. */
export async function PATCH(request: Request, { params }: Contexto) {
  if (!pedidoDoPainel(request.headers)) return recusado();
  const { id } = await params;
  const corpo = (await request.json().catch(() => null)) as { ativa?: unknown } | null;
  if (typeof corpo?.ativa !== 'boolean') return falha('Diga se a vigilância fica ativa ou pausada.', 400);
  return definirAtiva(banco(), id, corpo.ativa) ? ok({ id, ativa: corpo.ativa }) : falha('Vigilância não encontrada.', 404);
}

/** Troca a vigilancia por uma nova versao ja confirmada (editar = novo pedido + confirmacao). */
export async function PUT(request: Request, { params }: Contexto) {
  if (!pedidoDoPainel(request.headers)) return recusado();
  const { id } = await params;
  const corpo = (await request.json().catch(() => null)) as { vigilancia?: unknown } | null;
  const validada = novaVigilanciaSchema.safeParse(corpo?.vigilancia);
  if (!validada.success) {
    return falha('A vigilância está fora do formato.', 400, validada.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }
  const atualizada = atualizarVigilancia(banco(), id, validada.data);
  return atualizada ? ok(atualizada) : falha('Vigilância não encontrada.', 404);
}

/** Apaga a vigilancia e tudo dela (precos, ofertas, avisos). */
export async function DELETE(request: Request, { params }: Contexto) {
  if (!pedidoDoPainel(request.headers)) return recusado();
  const { id } = await params;
  return apagarVigilancia(banco(), id) ? ok({ id }) : falha('Vigilância não encontrada.', 404);
}
