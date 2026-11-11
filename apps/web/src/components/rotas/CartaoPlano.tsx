import { Detalhes } from './Detalhes';
import type { Plano } from './tipos';

interface Props {
  plano: Plano;
  salvando: boolean;
  editando: boolean;
  aoSalvar: () => void;
  aoCorrigir: () => void;
}

/** O que o Claude entendeu do pedido, para conferir antes de salvar (RF-01). */
export function CartaoPlano({ plano, salvando, editando, aoSalvar, aoCorrigir }: Props) {
  const { estimativa } = plano;
  return (
    <section
      aria-label="O que o Frank entendeu"
      className="mt-6 rounded-xl border border-[var(--color-borda)] p-5 md:p-6"
    >
      <h2 className="text-lg font-semibold">Confira o que eu entendi</h2>
      <p className="mt-2 text-base">{plano.resumo}</p>

      <div className="mt-5">
        <Detalhes v={plano.vigilancia} />
      </div>

      {plano.duvidas.length > 0 && (
        <div className="mt-5 rounded-lg bg-[var(--color-superficie)] p-4">
          <p className="text-sm font-medium">
            O que eu supus (corrija o pedido se algo estiver errado):
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-texto-suave)]">
            {plano.duvidas.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      <p
        className={`mt-4 text-sm ${estimativa.cabeNoTeto ? 'text-[var(--color-texto-suave)]' : 'text-[var(--color-aviso)]'}`}
      >
        Até {estimativa.consultasPorDia} consultas por dia ({estimativa.pares}{' '}
        {estimativa.pares === 1 ? 'par' : 'pares'} de aeroportos).
        {!estimativa.cabeNoTeto &&
          ' Passa do teto de 300 por dia: parte das rotas vai ficar sem checagem. Tire alguns destinos ou aumente o intervalo.'}
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={aoSalvar}
          disabled={salvando}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--color-destaque)] px-5 text-base font-medium text-white disabled:opacity-60"
        >
          {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Salvar e começar a vigiar'}
        </button>
        <button
          type="button"
          onClick={aoCorrigir}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--color-borda)] px-5 text-base"
        >
          Corrigir pedido
        </button>
      </div>
    </section>
  );
}
