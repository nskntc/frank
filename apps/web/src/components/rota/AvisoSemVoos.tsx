import type { Situacao } from '@/lib/situacao';

type SemVoos = Extract<Situacao, { tipo: 'sem_voos' }>;

/**
 * A consulta funcionou, mas a fonte nao achou nenhum voo (issue #22). Diz isso com todas as
 * letras e sugere o que mudar no pedido; sem isso, o painel parece travado.
 */
export function AvisoSemVoos({ s, compacto = false }: { s: SemVoos; compacto?: boolean }) {
  const titulo = s.nuncaAchou
    ? 'A fonte não achou nenhum voo para essa viagem'
    : 'A última checagem não achou voo';
  const explicacao = s.nuncaAchou
    ? `Última checagem ${s.quando}. A consulta funcionou, mas a Kiwi não vende esse trajeto nessas condições. O Frank segue checando.`
    : `Checagem ${s.quando}. Antes havia voos: os lugares podem ter acabado ou a fonte oscilou. O Frank segue checando.`;

  const lista =
    s.sugestoes.length > 0 ? (
      <ul className="mt-2 space-y-2">
        {s.sugestoes.map((g) => (
          <li key={g.noPedido} className="text-sm">
            {g.texto}{' '}
            <span className="text-[var(--color-texto-suave)]">
              Em Editar, acrescente ao pedido: “{g.noPedido}”.
            </span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-2 text-sm text-[var(--color-texto-suave)]">
        Tente outras datas ou outros aeroportos, em Editar.
      </p>
    );

  if (compacto) {
    return (
      <div className="mt-2">
        <p className="text-sm text-[var(--color-aviso)]">
          {titulo} (checagem {s.quando}).
        </p>
        {s.nuncaAchou && (
          <details className="mt-1">
            <summary className="min-h-11 cursor-pointer py-2 text-sm">
              O que mudar no pedido
            </summary>
            {lista}
          </details>
        )}
      </div>
    );
  }

  return (
    <div
      role="status"
      className="mt-3 rounded-lg border border-[var(--color-aviso)]/60 bg-[var(--color-aviso)]/10 p-4"
    >
      <p className="text-base font-medium">{titulo}</p>
      <p className="mt-1 text-sm text-[var(--color-texto-suave)]">{explicacao}</p>
      {s.nuncaAchou && (
        <>
          <p className="mt-3 text-sm font-medium">Para aumentar as chances:</p>
          {lista}
        </>
      )}
    </div>
  );
}
