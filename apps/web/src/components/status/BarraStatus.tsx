import { headers } from 'next/headers';
import Link from 'next/link';
import { haQuanto, plural } from '@/lib/formatar';
import { hostLocal } from '@/lib/servidor/origem';
import { banco } from '@/lib/servidor/recursos';
import { montarStatus } from '@/lib/status';
import { AtualizarSozinho } from './AtualizarSozinho';

/**
 * Barra de status (RF-19), em toda tela: o vigia esta vivo, quando foi a ultima checagem e se ha
 * problema. Nunca diz "tudo certo" sem saber: vigia sem sinal aparece como parado, com ha quanto.
 */
export async function BarraStatus() {
  if (!hostLocal(await headers())) return null;
  let s: ReturnType<typeof montarStatus>;
  try {
    s = montarStatus(banco());
  } catch {
    return (
      <p
        role="status"
        className="border-b border-[var(--color-borda)] bg-[var(--color-aviso)]/10 px-4 py-2 text-center text-sm"
      >
        Não consegui ler o banco do Frank. Confira se a pasta <code>data/</code> existe e se o vigia
        rodou ao menos uma vez.
      </p>
    );
  }

  const alerta = s.vigia.estado !== 'ligado' || s.problemas.length > 0;
  let principal: string;
  if (s.vigia.estado === 'nunca')
    principal =
      'O vigia ainda não rodou. Ligue com pnpm start na pasta do Frank.';
  else if (s.vigia.estado === 'parado' && s.vigia.vistoEm)
    principal = `Vigia parado ${haQuanto(s.vigia.vistoEm)}: computador dormindo ou vigia desligado.`;
  else principal = 'Vigia ligado';

  return (
    <div
      role="status"
      className={`border-b border-[var(--color-borda)] ${alerta ? 'bg-[var(--color-aviso)]/10' : 'bg-[var(--color-superficie)]'}`}
    >
      <AtualizarSozinho segundos={60} />
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm md:px-8">
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className={`inline-block h-2 w-2 rounded-full ${s.vigia.estado === 'ligado' ? 'bg-[var(--color-ok)]' : 'bg-[var(--color-aviso)]'}`}
          />
          {principal}
        </span>
        {s.ultimaChecagemEm && (
          <span className="text-[var(--color-texto-suave)]">
            · última checagem {haQuanto(s.ultimaChecagemEm)}
          </span>
        )}
        <span className="text-[var(--color-texto-suave)]">
          · {plural(s.vigilanciasAtivas, 'rota ativa', 'rotas ativas')}
        </span>
        {s.problemas.length > 0 && (
          <Link
            href="/configuracoes#status"
            className="ml-auto inline-flex min-h-8 items-center font-medium underline underline-offset-2"
          >
            {plural(s.problemas.length, 'aviso', 'avisos')} →
          </Link>
        )}
      </div>
    </div>
  );
}
