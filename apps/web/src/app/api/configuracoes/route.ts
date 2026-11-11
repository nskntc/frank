import { CONFIGURACOES, emTransacao, gravarConfiguracaoNumero } from '@frank/banco';
import { z } from 'zod';
import { pedidoDoPainel } from '@/lib/servidor/origem';
import { banco } from '@/lib/servidor/recursos';
import { falha, ok, recusado } from '@/lib/servidor/resposta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const { toleranciaCompanhiaPct: tol, silencioInicio: ini, silencioFim: fim } = CONFIGURACOES;

const configuracoesSchema = z
  .object({
    toleranciaPct: z.number().int().min(tol.min).max(tol.max),
    /** -1 desliga o horario silencioso. */
    silencioInicio: z.number().int().min(ini.min).max(ini.max),
    silencioFim: z.number().int().min(fim.min).max(fim.max),
  })
  .strict();

/** Grava as configuracoes da tela (RF-14, RF-17, RF-19). Tudo ou nada. */
export async function PUT(request: Request) {
  if (!pedidoDoPainel(request.headers)) return recusado();
  const corpo = await request.json().catch(() => null);
  const r = configuracoesSchema.safeParse(corpo);
  if (!r.success) {
    return falha(
      'Configurações fora do formato.',
      400,
      r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    );
  }
  if (r.data.silencioInicio !== -1 && r.data.silencioInicio === r.data.silencioFim) {
    return falha('O horário silencioso precisa começar e terminar em horas diferentes.', 400);
  }
  const db = banco();
  emTransacao(db, () => {
    gravarConfiguracaoNumero(db, tol, r.data.toleranciaPct);
    gravarConfiguracaoNumero(db, ini, r.data.silencioInicio);
    gravarConfiguracaoNumero(db, fim, r.data.silencioFim);
  });
  return ok(r.data);
}
