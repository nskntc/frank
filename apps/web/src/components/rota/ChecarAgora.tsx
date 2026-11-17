'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface Props {
  id: string;
  ativa: boolean;
  /** Ha um pedido esperando o vigia (vem do servidor a cada atualizacao da pagina). */
  pendente: boolean;
  vigiaLigado: boolean;
  /** "há 59 min", ou null se a rota nunca rodou. */
  ultimaChecagem: string | null;
}

/** Enquanto espera o vigia, rele a pagina neste ritmo; desiste depois de PRAZO_MS. */
const RITMO_MS = 5_000;
const PRAZO_MS = 5 * 60_000;

/**
 * Botao "Checar agora" (issue #26). O painel so grava o pedido; o vigia, que acorda a cada
 * minuto, checa a rota no proximo tique. A pagina se atualiza sozinha ate o resultado chegar.
 */
export function ChecarAgora({ id, ativa, pendente, vigiaLigado, ultimaChecagem }: Props) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [terminou, setTerminou] = useState(false);
  const esperava = useRef(pendente);

  // Pedido saiu da fila (o vigia marcou a rodada): avisa que o resultado ja esta na tela.
  useEffect(() => {
    if (esperava.current && !pendente) setTerminou(true);
    esperava.current = pendente;
  }, [pendente]);

  useEffect(() => {
    if (!pendente || !vigiaLigado) return;
    const inicio = Date.now();
    const relogio = setInterval(() => {
      if (Date.now() - inicio > PRAZO_MS) clearInterval(relogio);
      else router.refresh();
    }, RITMO_MS);
    return () => clearInterval(relogio);
  }, [pendente, vigiaLigado, router]);

  async function checar() {
    setEnviando(true);
    setErro(null);
    setTerminou(false);
    try {
      const r = await fetch(`/api/vigilancias/${encodeURIComponent(id)}/checar`, {
        method: 'POST',
      });
      if (!r.ok) {
        const corpo = (await r.json().catch(() => null)) as { erro?: string } | null;
        setErro(corpo?.erro ?? 'Não consegui pedir a checagem. Tente de novo.');
        return;
      }
      esperava.current = true;
      router.refresh();
    } catch {
      setErro('Não consegui falar com o painel. Ele está ligado?');
    } finally {
      setEnviando(false);
    }
  }

  let nota: string;
  if (!ativa) nota = 'Rota pausada: retome a rota para checar.';
  else if (pendente && !vigiaLigado)
    nota = 'Pedido anotado, mas o vigia está desligado. A checagem roda assim que ele ligar.';
  else if (pendente)
    nota = 'O vigia pega a rota em até 1 minuto. A página se atualiza sozinha.';
  else if (terminou)
    nota = `Checagem feita ${ultimaChecagem ?? 'agora'}. O resultado já está abaixo.`;
  else nota = ultimaChecagem ? `Última checagem ${ultimaChecagem}.` : 'Ainda não checada.';

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      <button
        type="button"
        onClick={() => void checar()}
        disabled={!ativa || pendente || enviando}
        className="inline-flex min-h-11 items-center rounded-lg border border-[var(--color-borda)] px-4 font-medium disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pendente || enviando ? 'Checando…' : 'Checar agora'}
      </button>
      <p className="text-sm text-[var(--color-texto-suave)]" role="status" aria-live="polite">
        {erro ? <span className="text-[var(--color-aviso)]">{erro}</span> : nota}
      </p>
    </div>
  );
}
