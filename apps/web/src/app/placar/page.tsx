import { avisosEntregues, listarPlacar, listarVigilancias } from '@frank/banco';
import { diaNoFuso, formatarReais } from '@frank/dominio';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TelaVazia } from '@/components/TelaVazia';
import { FormAlertaGoogle } from '@/components/placar/FormAlertaGoogle';
import { type LanceNaTela, ListaLances } from '@/components/placar/ListaLances';
import { quandoEmBrasilia } from '@/lib/formatar';
import { MARGEM_MESMO_PRECO_PCT, montarPlacar, resultadoDoLance } from '@/lib/placar';
import { hostLocal } from '@/lib/servidor/origem';
import { banco } from '@/lib/servidor/recursos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function Marcador({ quem, pontos }: { quem: 'frank' | 'google'; pontos: number }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className={`inline-block h-3 w-3 rounded-full ${quem === 'frank' ? 'bg-[var(--serie-1)]' : 'bg-[var(--serie-2)]'}`}
      />
      <span className="text-base">{quem === 'frank' ? 'Frank' : 'Google'}</span>
      <span className="text-3xl font-semibold tabular-nums">{pontos}</span>
    </span>
  );
}

function Placar({ frank, google }: { frank: number; google: number }) {
  return (
    <p
      className="flex flex-wrap items-center gap-x-4 gap-y-1"
      aria-label={`Frank ${frank}, Google ${google}`}
    >
      <Marcador quem="frank" pontos={frank} />
      <span aria-hidden className="text-[var(--color-texto-suave)]">
        ×
      </span>
      <Marcador quem="google" pontos={google} />
    </p>
  );
}

/** Placar contra o alerta do Google Flights (RF-20): a corrida de 30 dias, rota por rota. */
export default async function PlacarPagina() {
  if (!hostLocal(await headers())) notFound();
  const db = banco();
  const vigilancias = listarVigilancias(db);

  if (vigilancias.length === 0) {
    return (
      <TelaVazia
        titulo="Placar"
        descricao="A corrida contra o alerta de preço do Google Flights: quem avisa primeiro o menor preço, na mesma rota. Crie uma rota em Rotas e ligue o alerta do Google para a mesma viagem."
      >
        <Link
          href="/rotas"
          className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-[var(--color-destaque)] px-5 text-base font-medium text-white"
        >
          Criar uma rota
        </Link>
      </TelaVazia>
    );
  }

  const hoje = diaNoFuso(new Date());
  const rotas = vigilancias.map((v) => ({
    v,
    placar: montarPlacar(avisosEntregues(db, v.id), listarPlacar(db, v.id), v.moeda),
  }));
  const total = rotas.reduce(
    (t, r) => ({ frank: t.frank + r.placar.pontos.frank, google: t.google + r.placar.pontos.google }),
    { frank: 0, google: 0 },
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Placar</h1>
      <p className="mt-2 max-w-prose text-base text-[var(--color-texto-suave)]">
        A corrida contra o alerta de preço do Google Flights. Quando o e-mail do Google chegar,
        registre aqui a hora e o preço. Os avisos do Frank entram sozinhos.
      </p>

      <section
        aria-label="Placar geral"
        className="mt-6 rounded-xl border border-[var(--color-borda)] p-4 md:p-5"
      >
        <h2 className="text-sm text-[var(--color-texto-suave)]">Todas as rotas</h2>
        <div className="mt-1">
          <Placar {...total} />
        </div>
        <details className="mt-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm">Como o ponto é contado</summary>
          <ul className="mt-1 max-w-prose list-disc space-y-1 pl-5 text-sm text-[var(--color-texto-suave)]">
            <li>
              Cada alerta do Google é uma disputa. Se o Frank já tinha avisado um preço igual ou
              menor antes, o ponto é do Frank. Se avisou depois, ou nunca avisou, o ponto é do
              Google.
            </li>
            <li>
              Cada novo menor preço do Frank que o Google ainda não tinha avisado também é ponto
              do Frank.
            </li>
            <li>
              Até {MARGEM_MESMO_PRECO_PCT}% de diferença conta como o mesmo preço: os sites
              arredondam diferente.
            </li>
            <li>Vale o preço sem IOF, na moeda da rota.</li>
          </ul>
        </details>
      </section>

      <div className="mt-8 space-y-6">
        {rotas.map(({ v, placar }) => {
          const lances: LanceNaTela[] = placar.linhas.map((l) => ({
            chave: l.chave,
            quem: l.quem,
            quando: quandoEmBrasilia(l.vistoEm),
            preco: formatarReais(l.precoCentavos),
            resultado: resultadoDoLance(l),
            ponto: l.ponto,
            detalhe:
              [
                l.confirmado === null
                  ? null
                  : l.confirmado
                    ? 'conferido até o pagamento'
                    : 'preço não conferido',
                l.observacao,
              ]
                .filter(Boolean)
                .join(' · ') || null,
            registroId: l.registroId,
          }));
          return (
            <section
              key={v.id}
              aria-label={v.descricao}
              className="rounded-xl border border-[var(--color-borda)] p-4 md:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1 basis-64">
                  <h2 className="text-base font-medium break-words">{v.descricao}</h2>
                  <p className="mt-0.5 text-sm text-[var(--color-texto-suave)]">
                    {v.origens.join(', ')} → {v.destinos.join(', ')}
                    {v.ativa ? '' : ' · pausada'} ·{' '}
                    <Link
                      href={`/rotas/${encodeURIComponent(v.id)}`}
                      className="underline underline-offset-2"
                    >
                      ver preços
                    </Link>
                  </p>
                </div>
                <Placar {...placar.pontos} />
              </div>

              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <div className="flex gap-1.5">
                  <dt className="text-[var(--color-texto-suave)]">Menor do Frank:</dt>
                  <dd className="font-medium tabular-nums">
                    {placar.menor.frank !== null ? formatarReais(placar.menor.frank) : '—'}
                  </dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-[var(--color-texto-suave)]">Menor do Google:</dt>
                  <dd className="font-medium tabular-nums">
                    {placar.menor.google !== null ? formatarReais(placar.menor.google) : '—'}
                  </dd>
                </div>
              </dl>

              {lances.length > 0 ? (
                <ListaLances lances={lances} />
              ) : (
                <p className="mt-3 text-sm text-[var(--color-texto-suave)]">
                  Nenhum aviso ainda, de nenhum dos dois.
                </p>
              )}

              <FormAlertaGoogle vigilanciaId={v.id} hoje={hoje} />
            </section>
          );
        })}
      </div>
    </main>
  );
}
