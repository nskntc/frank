import { planejarVigilancia, PlanoInvalidoError } from '@frank/agente';
import { IaIndisponivelError, RespostaIaInvalidaError } from '@frank/ia';
import { estimarConsultas } from '@/lib/estimativa';
import { pedidoDoPainel } from '@/lib/servidor/origem';
import { ia } from '@/lib/servidor/recursos';
import { falha, ok, recusado } from '@/lib/servidor/resposta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * O Claude entende o pedido em texto livre (RF-01). Nao salva nada: devolve o plano, as duvidas
 * e a estimativa de consultas para a pessoa conferir.
 */
export async function POST(request: Request) {
  if (!pedidoDoPainel(request.headers)) return recusado();
  const corpo = (await request.json().catch(() => null)) as { pedido?: unknown } | null;
  if (typeof corpo?.pedido !== 'string')
    return falha('Escreva a viagem que você quer vigiar.', 400);

  try {
    const plano = await planejarVigilancia(ia(), corpo.pedido);
    return ok({ ...plano, estimativa: estimarConsultas(plano.vigilancia) });
  } catch (erro) {
    if (erro instanceof PlanoInvalidoError) {
      return falha(
        'Não consegui montar a vigilância com esse pedido. Tente escrever de outro jeito.',
        422,
        erro.problemas,
      );
    }
    if (erro instanceof IaIndisponivelError) return falha(erro.message, 503);
    if (erro instanceof RespostaIaInvalidaError) {
      return falha('O Claude respondeu fora do formato duas vezes. Tente de novo.', 502);
    }
    return falha('Algo deu errado ao entender o pedido.', 500);
  }
}
