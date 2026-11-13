import { type EtiquetaCompra, formatarReais } from '@frank/dominio';
import { Trecho } from '@/components/voo/Trecho';
import { haQuanto } from '@/lib/formatar';
import type { OfertaNaTela } from '@/lib/ofertas';

const ETIQUETAS: Record<EtiquetaCompra, string> = {
  '24h_para_desistir': '24 h para desistir',
  empresa_estrangeira: 'empresa estrangeira, com IOF',
};

function Avaliacao({ o }: { o: OfertaNaTela }) {
  // Texto do Claude sempre como texto puro: o React escapa, e nada dele vira link.
  if (o.valeAPena === null) {
    return (
      <p className="text-sm text-[var(--color-texto-suave)]">
        Sem avaliação do Claude desta vez: confira os horários e as escalas antes de comprar.
      </p>
    );
  }
  return (
    <p className="text-sm">
      <span className="font-medium">{o.valeAPena ? 'Vale a pena: ' : 'Atenção: '}</span>
      {o.resumo}
    </p>
  );
}

/** Card de uma oferta (RF-18): preco, trechos, pegadinhas e Onde comprar. */
export function CartaoOferta({ o }: { o: OfertaNaTela }) {
  const it = o.itinerario;
  return (
    <article className="rounded-xl border border-[var(--color-borda)] p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">
            {it.ida.de} → {it.ida.para}
            <span className="ml-2 text-sm font-normal text-[var(--color-texto-suave)]">
              {it.volta ? 'ida e volta' : 'só ida'} · {o.adultos}{' '}
              {o.adultos === 1 ? 'adulto' : 'adultos'}
            </span>
          </h2>
          <p className="mt-0.5 text-sm break-words text-[var(--color-texto-suave)]">
            {o.descricao}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-2xl font-semibold tracking-tight">{formatarReais(o.precoCentavos)}</p>
          {o.percentualAbaixo !== null && o.percentualAbaixo > 0 && (
            <p className="text-sm font-medium text-[var(--color-destaque)]">
              {o.percentualAbaixo}% abaixo do normal
              {o.precoNormalCentavos !== null && (
                <span className="font-normal text-[var(--color-texto-suave)]">
                  {' '}
                  ({formatarReais(o.precoNormalCentavos)})
                </span>
              )}
            </p>
          )}
        </div>
      </header>

      <div className="mt-4 space-y-3">
        <Trecho nome="Ida" p={it.ida} />
        {it.volta && <Trecho nome="Volta" p={it.volta} />}
        <p className="text-sm text-[var(--color-texto-suave)]">
          Mala despachada: {it.malas.despachada > 0 ? 'incluída' : 'não incluída'} · conferido{' '}
          {haQuanto(o.vistoEm)}
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {o.foraDaPreferencia?.length === 0 && (
          <p className="inline-flex rounded-md bg-[var(--color-destaque)]/10 px-2 py-1 text-xs font-medium text-[var(--color-destaque)]">
            Do jeito que você prefere
          </p>
        )}
        {o.foraDaPreferencia && o.foraDaPreferencia.length > 0 && (
          <p className="text-xs text-[var(--color-texto-suave)]">
            Fora da sua preferência: {o.foraDaPreferencia.join('; ')}.
          </p>
        )}
        <Avaliacao o={o} />
        {o.pegadinhas.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Cuidados">
            {o.pegadinhas.map((p) => (
              <li
                key={p.descricao}
                className="rounded-md border border-[var(--color-aviso)]/60 bg-[var(--color-aviso)]/10 px-2 py-1 text-xs"
              >
                {p.descricao}
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="mt-5" aria-label="Onde comprar">
        <h3 className="text-sm font-semibold">Onde comprar (preço final)</h3>
        <ul className="mt-2 divide-y divide-[var(--color-borda)] rounded-lg border border-[var(--color-borda)]">
          {o.compras.map((c, i) => {
            const destaque = i === o.destacado;
            return (
              <li
                key={`${c.vendedor}-${i}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-words">
                    {c.vendedor}
                    {c.ehCompanhia && (
                      <span className="font-normal text-[var(--color-texto-suave)]">
                        {' '}
                        · companhia
                      </span>
                    )}
                  </p>
                  {c.etiquetas.length > 0 && (
                    <p className="text-xs text-[var(--color-texto-suave)]">
                      {c.etiquetas.map((e) => ETIQUETAS[e]).join(' · ')}
                    </p>
                  )}
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {formatarReais(c.precoFinalCentavos)}
                </span>
                {c.link ? (
                  <a
                    href={c.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium ${
                      destaque
                        ? 'bg-[var(--color-destaque)] text-white'
                        : 'border border-[var(--color-borda)]'
                    }`}
                  >
                    Comprar
                  </a>
                ) : (
                  <span className="text-xs text-[var(--color-texto-suave)]">sem link</span>
                )}
              </li>
            );
          })}
        </ul>
        {o.companhiaNaTolerancia && (
          <p className="mt-2 text-xs text-[var(--color-texto-suave)]">
            Destacada: a companhia custa pouco mais e dá as 24 h para desistir.
          </p>
        )}
      </section>
    </article>
  );
}
