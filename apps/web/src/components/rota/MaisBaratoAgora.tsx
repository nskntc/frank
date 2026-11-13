import { formatarReais } from '@frank/dominio';
import { Trecho } from '@/components/voo/Trecho';
import { haQuanto } from '@/lib/formatar';
import type { VooNaTela } from '@/lib/rota';

/**
 * Os voos mais baratos da ultima checagem, com botao de compra (issue #20). Nao e oferta: e o
 * melhor preco do momento, para a pessoa sempre ter onde clicar.
 */
export function MaisBaratoAgora({ voos }: { voos: VooNaTela[] }) {
  const quando = voos[0]?.vistoEm;
  const comPreferencia = voos.some((v) => v.foraDaPreferencia !== null);
  const algumNoJeito = voos.some((v) => v.foraDaPreferencia?.length === 0);
  return (
    <section className="mt-8" aria-labelledby="mais-barato-agora">
      <h2 id="mais-barato-agora" className="text-lg font-semibold">
        Mais barato agora
      </h2>
      {voos.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-[var(--color-borda)] bg-[var(--color-superficie)] p-6 text-sm text-[var(--color-texto-suave)]">
          Ainda sem voos para mostrar. Com o vigia ligado, a próxima checagem traz os mais baratos
          com o link para comprar.
        </p>
      ) : (
        <>
          <p className="mt-1 max-w-prose text-sm text-[var(--color-texto-suave)]">
            Os voos mais baratos da última checagem ({quando ? haQuanto(quando) : ''}). Não são
            ofertas, só o melhor preço do momento: confira o valor final no site antes de pagar.
            {comPreferencia &&
              (algumNoJeito
                ? ' O primeiro é o mais barato no horário que você prefere.'
                : ' Nenhum desta checagem bate com o horário que você prefere: estes são os mais baratos.')}
          </p>
          <ol className="mt-3 space-y-3">
            {voos.map((v) => (
              <li
                key={v.chave}
                className="rounded-xl border border-[var(--color-borda)] p-4 md:flex md:items-start md:gap-6"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  {v.foraDaPreferencia?.length === 0 && (
                    <p className="inline-flex rounded-md bg-[var(--color-destaque)]/10 px-2 py-1 text-xs font-medium text-[var(--color-destaque)]">
                      Do jeito que você prefere
                    </p>
                  )}
                  <Trecho nome="Ida" p={v.itinerario.ida} />
                  {v.itinerario.volta && <Trecho nome="Volta" p={v.itinerario.volta} />}
                  <p className="text-xs text-[var(--color-texto-suave)]">
                    Mala despachada:{' '}
                    {v.itinerario.malas.despachada > 0 ? 'incluída' : 'não incluída'}
                  </p>
                  {v.foraDaPreferencia && v.foraDaPreferencia.length > 0 && (
                    <p className="text-xs text-[var(--color-texto-suave)]">
                      Fora da sua preferência: {v.foraDaPreferencia.join('; ')}.
                    </p>
                  )}
                  {v.pegadinhas.length > 0 && (
                    <ul className="flex flex-wrap gap-2" aria-label="Cuidados">
                      {v.pegadinhas.map((p) => (
                        <li
                          key={p}
                          className="rounded-md border border-[var(--color-aviso)]/60 bg-[var(--color-aviso)]/10 px-2 py-1 text-xs"
                        >
                          {p}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 md:mt-0 md:flex-col md:items-end">
                  <div className="md:text-right">
                    <p className="text-xl font-semibold tabular-nums">
                      {formatarReais(v.precoCentavos)}
                    </p>
                    <p className="text-xs text-[var(--color-texto-suave)]">
                      {v.vendedor}
                      {v.estrangeiro ? ' · empresa estrangeira, com IOF' : ''}
                    </p>
                  </div>
                  {v.link ? (
                    <a
                      href={v.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--color-destaque)] px-5 text-sm font-medium text-white md:ml-0"
                    >
                      Comprar
                    </a>
                  ) : (
                    <span className="text-xs text-[var(--color-texto-suave)]">sem link</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
