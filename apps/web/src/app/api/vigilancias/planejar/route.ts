import { planejarVigilancia, PlanoInvalidoError } from '@frank/agente';
import { IaIndisponivelError, RespostaIaInvalidaError } from '@frank/ia';
import { listarVigilancias } from '@frank/banco';
import { estimarConsultas, limitesDoAmbiente } from '@/lib/estimativa';
import { pedidoDoPainel } from '@/lib/servidor/origem';
import { banco, ia } from '@/lib/servidor/recursos';
import { falha, ok, recusado } from '@/lib/servidor/resposta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * O Claude entende o pedido em texto livre (RF-01). Nao salva nada: devolve o plano, as duvidas
 * e a estimativa de consultas (junto com as outras rotas ativas) para a pessoa conferir. Na edicao,
 * `editandoId` tira a propria rota da conta.
 */
export async function POST(request: Request) {
  if (!pedidoDoPainel(request.headers)) return recusado();
  const corpo = (await request.json().catch(() => null)) as {
    pedido?: unknown;
    editandoId?: unknown;
  } | null;
  if (typeof corpo?.pedido !== 'string')
    return falha('Escreva a viagem que você quer vigiar.', 400);

  try {
    const plano = await planejarVigilancia(ia(), corpo.pedido);
    const editandoId = typeof corpo.editandoId === 'string' ? corpo.editandoId : null;
    const outras = listarVigilancias(banco(), { soAtivas: true }).filter(
      (v) => v.id !== editandoId,
    );
    return ok({
      ...plano,
      estimativa: estimarConsultas(plano.vigilancia, outras, limitesDoAmbiente()),
    });
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
