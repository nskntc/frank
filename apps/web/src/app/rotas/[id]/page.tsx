import { formatarReais } from '@frank/dominio';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GraficoPreco } from '@/components/rota/GraficoPreco';
import { diaComSemana, janela, plural } from '@/lib/formatar';
import { detalheDaRota } from '@/lib/rota';
import { hostLocal } from '@/lib/servidor/origem';
import { banco } from '@/lib/servidor/recursos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function Numero({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-borda)] p-3">
      <dt className="text-xs text-[var(--color-texto-suave)]">{rotulo}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{valor}</dd>
      {nota && <dd className="text-xs text-[var(--color-texto-suave)]">{nota}</dd>}
    </div>
  );
}

const NOTA_NORMAL = {
  proprio: 'mediana das checagens dos últimos 14 dias',
  google: 'pela referência do Google (60 dias)',
} as const;

/** Detalhe da rota (RF-18): o preco ao longo do tempo, com o preco normal e o preco-alvo. */
export default async function DetalheDaRota({ params }: { params: Promise<{ id: string }> }) {
  if (!hostLocal(await headers())) notFound();
  const { id } = await params;
  const d = detalheDaRota(banco(), id);
  if (!d) notFound();
  const v = d.vigilancia;

  const menor = d.frank.reduce<number | null>(
    (m, p) => (m === null || p.precoCentavos < m ? p.precoCentavos : m),
    null,
  );
  const semDados = d.frank.length === 0 && d.google.length === 0;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <Link
        href="/rotas"
        className="inline-flex min-h-11 items-center text-sm text-[var(--color-texto-suave)]"
      >
        ← Rotas vigiadas
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight break-words md:text-3xl">
        {v.descricao}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-texto-suave)]">
        {v.origens.join(', ')} → {v.destinos.join(', ')} · ida {janela(v.idaDe, v.idaAte)}
        {v.voltaDe && v.voltaAte ? ` · volta ${janela(v.voltaDe, v.voltaAte)}` : ' · só ida'}
        {v.ativa ? '' : ' · pausada'}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Numero
          rotulo="Menor preço visto"
          valor={menor !== null ? formatarReais(menor) : '—'}
          nota="pelo Frank, sem IOF"
        />
        <Numero
          rotulo="Preço normal"
          valor={d.normal ? formatarReais(d.normal.centavos) : '—'}
          nota={d.normal ? NOTA_NORMAL[d.normal.base] : 'ainda sem histórico suficiente'}
        />
        <Numero
          rotulo="Preço-alvo"
          valor={v.precoAlvoCentavos !== null ? formatarReais(v.precoAlvoCentavos) : '—'}
        />
        <Numero
          rotulo="Checagens"
          valor={String(d.frank.length)}
          nota="desde a última mudança da viagem"
        />
      </dl>

      <section className="mt-8" aria-label="Preço ao longo do tempo">
        <h2 className="text-lg font-semibold">Preço ao longo do tempo</h2>
        {semDados ? (
          <p className="mt-3 rounded-lg border border-dashed border-[var(--color-borda)] bg-[var(--color-superficie)] p-6 text-sm text-[var(--color-texto-suave)]">
            Ainda sem preços para mostrar. Com o vigia ligado, cada checagem vira um ponto aqui
            {v.ativa ? '' : ' (esta vigilância está pausada)'}.
          </p>
        ) : (
          <>
            <GraficoPreco
              frank={d.frank}
              google={d.google}
              normalCentavos={d.normal?.centavos ?? null}
              alvoCentavos={v.precoAlvoCentavos}
            />
            <p className="mt-2 text-xs text-[var(--color-texto-suave)]">
              Preços sem IOF, na moeda da vigilância. Horários de Brasília.
            </p>
            <details className="mt-4">
              <summary className="min-h-11 cursor-pointer py-2 text-sm">
                Ver em tabela ({plural(d.dias.length, 'dia', 'dias')})
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm tabular-nums">
                  <thead>
                    <tr className="border-b border-[var(--color-borda)] text-left text-[var(--color-texto-suave)]">
                      <th className="py-2 pr-4 font-normal">Dia</th>
                      <th className="py-2 pr-4 text-right font-normal">Menor do Frank</th>
                      <th className="py-2 text-right font-normal">Google</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.dias.map((l) => (
                      <tr key={l.dia} className="border-b border-[var(--color-borda)]">
                        <td className="py-2 pr-4">{diaComSemana(l.dia)}</td>
                        <td className="py-2 pr-4 text-right">
                          {l.frank !== null ? formatarReais(l.frank) : '—'}
                        </td>
                        <td className="py-2 text-right">
                          {l.google !== null ? formatarReais(l.google) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </section>
    </main>
  );
}
