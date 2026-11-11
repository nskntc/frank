import type { ReactNode } from 'react';

interface Props {
  titulo: string;
  descricao: string;
  children?: ReactNode;
}

/** Cabecalho da tela e estado vazio, enquanto a Fase 1 nao traz os dados. */
export function TelaVazia({ titulo, descricao, children }: Props) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{titulo}</h1>
      <div className="mt-6 rounded-xl border border-dashed border-[var(--color-borda)] bg-[var(--color-superficie)] p-6 md:p-10">
        <p className="max-w-prose text-base text-[var(--color-texto-suave)]">{descricao}</p>
        {children}
      </div>
    </main>
  );
}
