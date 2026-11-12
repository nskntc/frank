'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { chamar } from '@/lib/api';

export interface LanceNaTela {
  chave: string;
  quem: 'frank' | 'google';
  quando: string;
  preco: string;
  resultado: string;
  ponto: 'frank' | 'google' | null;
  detalhe: string | null;
  registroId: number | null;
}

const NOME = { frank: 'Frank', google: 'Google' } as const;
const COR = { frank: 'bg-[var(--serie-1)]', google: 'bg-[var(--serie-2)]' } as const;

/** Os avisos da corrida, do mais antigo ao mais novo. So o registro feito a mao pode ser apagado. */
export function ListaLances({ lances }: { lances: LanceNaTela[] }) {
  const router = useRouter();
  const [apagando, setApagando] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function apagar(id: number) {
    if (!window.confirm('Apagar este alerta do Google do placar?')) return;
    setApagando(id);
    setErro(null);
    const r = await chamar(`/api/placar/${id}`, { method: 'DELETE' });
    setApagando(null);
    if (r.ok) router.refresh();
    else setErro(r.erro);
  }

  return (
    <>
      {erro && (
        <p role="alert" className="mt-3 text-sm text-[var(--color-aviso)]">
          {erro}
        </p>
      )}
      <ol className="mt-4 divide-y divide-[var(--color-borda)] border-y border-[var(--color-borda)]">
        {lances.map((l) => (
          <li key={l.chave} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
            <div className="flex min-w-0 flex-1 basis-56 flex-col">
              <span className="flex flex-wrap items-center gap-x-2 text-sm">
                <span
                  aria-hidden
                  className={`inline-block h-2.5 w-2.5 rounded-full ${COR[l.quem]}`}
                />
                <span className="font-medium">{NOME[l.quem]}</span>
                <span className="text-[var(--color-texto-suave)] tabular-nums">{l.quando}</span>
              </span>
              <span className="mt-0.5 text-sm text-[var(--color-texto-suave)]">
                {l.resultado}
                {l.detalhe ? ` · ${l.detalhe}` : ''}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-base font-semibold tabular-nums">{l.preco}</span>
              {l.ponto && (
                <span className="rounded-full border border-[var(--color-borda)] px-2.5 py-0.5 text-xs font-medium whitespace-nowrap">
                  ponto {l.ponto === 'frank' ? 'do Frank' : 'do Google'}
                </span>
              )}
              {l.registroId !== null && (
                <button
                  type="button"
                  disabled={apagando === l.registroId}
                  onClick={() => void apagar(l.registroId as number)}
                  className="min-h-11 rounded-lg px-2 text-sm text-[var(--color-texto-suave)] underline underline-offset-2 disabled:opacity-60"
                >
                  Apagar
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
