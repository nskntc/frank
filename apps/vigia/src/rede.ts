import { lookup } from 'node:dns/promises';

/** Codigos de "nao achei o endereco": a rede local caiu (ou o DNS), nao a fonte. */
const SEM_REDE = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'ECONNREFUSED', 'TEMPO']);

/**
 * Ha internet? Resolve o endereco da fonte (issue #25). So diz "nao" quando o problema e claramente
 * de rede local; qualquer outra coisa diz "sim" e deixa a rodada mostrar o erro de verdade.
 */
export function conferidorDeRede(
  host = 'mcp.kiwi.com',
  tempoLimiteMs = 5_000,
  resolver: (host: string) => Promise<unknown> = (h) => lookup(h),
): () => Promise<boolean> {
  return async () => {
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const prazo = new Promise<never>((_, falhar) => {
      temporizador = setTimeout(
        () => falhar(Object.assign(new Error('tempo'), { code: 'TEMPO' })),
        tempoLimiteMs,
      );
    });
    try {
      await Promise.race([resolver(host), prazo]);
      return true;
    } catch (erro) {
      return !SEM_REDE.has(String((erro as { code?: unknown }).code));
    } finally {
      clearTimeout(temporizador);
    }
  };
}
