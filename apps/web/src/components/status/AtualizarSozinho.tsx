'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Rele os dados do servidor de tempos em tempos, sem perder o que esta digitado na tela. */
export function AtualizarSozinho({ segundos }: { segundos: number }) {
  const router = useRouter();
  useEffect(() => {
    const relogio = setInterval(() => router.refresh(), segundos * 1000);
    return () => clearInterval(relogio);
  }, [router, segundos]);
  return null;
}
