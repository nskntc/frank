import { apagarPlacar } from '@frank/banco';
import { pedidoDoPainel } from '@/lib/servidor/origem';
import { banco } from '@/lib/servidor/recursos';
import { falha, ok, recusado } from '@/lib/servidor/resposta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** Apaga um alerta registrado a mao (digitado errado). Os avisos do Frank nao se apagam aqui. */
export async function DELETE(request: Request, { params }: Contexto) {
  if (!pedidoDoPainel(request.headers)) return recusado();
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return falha('Registro inválido.', 400);
  return apagarPlacar(banco(), id) ? ok({ id }) : falha('Registro não encontrado.', 404);
}
