import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CartaoOferta } from '@/components/ofertas/CartaoOferta';
import { TelaVazia } from '@/components/TelaVazia';
import { ofertasParaTela } from '@/lib/ofertas';
import { hostLocal } from '@/lib/servidor/origem';
import { banco } from '@/lib/servidor/recursos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Tela inicial: as ofertas confirmadas, da mais barata para a mais cara (RF-18). */
export default async function Ofertas() {
  if (!hostLocal(await headers())) notFound();
  const ofertas = ofertasParaTela(banco());

  if (ofertas.length === 0) {
    return (
      <TelaVazia
        titulo="Ofertas"
        descricao="Nenhuma oferta ainda. Quando o Frank achar um preço muito abaixo do normal numa rota vigiada, ela aparece aqui, com onde comprar."
      >
        <Link
          href="/rotas"
          className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[var(--color-destaque)] px-5 text-base font-medium text-white"
        >
          Vigiar uma rota
        </Link>
      </TelaVazia>
    );
  }

  const valem = ofertas.filter((o) => o.valeAPena !== false);
  const naoValem = ofertas.filter((o) => o.valeAPena === false);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Ofertas</h1>
      <p className="mt-2 text-sm text-[var(--color-texto-suave)]">
        Antes de pagar, confira o preço final na tela de pagamento e use o nome exatamente como no
        documento.
      </p>

      <div className="mt-6 space-y-4">
        {valem.map((o) => (
          <CartaoOferta key={o.id} o={o} />
        ))}
        {valem.length === 0 && (
          <p className="text-sm text-[var(--color-texto-suave)]">
            Nenhuma oferta que o Claude ache que vale a pena agora.
          </p>
        )}
      </div>

      {naoValem.length > 0 && (
        <details className="mt-8">
          <summary className="min-h-11 cursor-pointer py-2 text-sm text-[var(--color-texto-suave)]">
            {naoValem.length}{' '}
            {naoValem.length === 1
              ? 'oferta que o Claude acha que não vale'
              : 'ofertas que o Claude acha que não valem'}{' '}
            a pena
          </summary>
          <div className="mt-3 space-y-4 opacity-80">
            {naoValem.map((o) => (
              <CartaoOferta key={o.id} o={o} />
            ))}
          </div>
        </details>
      )}
    </main>
  );
}
