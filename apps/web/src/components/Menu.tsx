'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { itemAtivo, NAVEGACAO } from '@/lib/navegacao';

export function Menu() {
  const caminho = usePathname();

  return (
    <header className="border-b border-[var(--color-borda)]">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 md:px-8">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Frank
        </Link>
        <nav aria-label="Telas do painel" className="-mx-2 flex overflow-x-auto">
          {NAVEGACAO.map((item) => {
            const ativo = itemAtivo(caminho, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-2 text-sm md:px-3 md:text-base ${
                  ativo
                    ? 'border-[var(--color-destaque)] font-medium text-[var(--color-texto)]'
                    : 'border-transparent text-[var(--color-texto-suave)] hover:text-[var(--color-texto)]'
                }`}
              >
                {item.rotulo}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
