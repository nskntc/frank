/** Resposta da API local do Frank. */
export type Resposta<T> = { ok: true; dados: T } | { ok: false; erro: string; problemas?: string[] };

/** Chama a API local e nunca lanca: erro de rede vira resposta com mensagem para a tela. */
export async function chamar<T>(url: string, init?: RequestInit): Promise<Resposta<T>> {
  try {
    const r = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    const corpo = (await r.json().catch(() => null)) as Resposta<T> | null;
    if (corpo && typeof corpo === 'object' && 'ok' in corpo) return corpo;
    return { ok: false, erro: `O painel respondeu de um jeito inesperado (HTTP ${r.status}).` };
  } catch {
    return { ok: false, erro: 'Não consegui falar com o painel. Ele ainda está rodando?' };
  }
}
