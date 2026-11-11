import { formatarReais } from '@frank/dominio';
import Link from 'next/link';
import { haQuanto, janela } from '@/lib/formatar';
import type { VigilanciaNaTela } from './tipos';

interface Props {
  v: VigilanciaNaTela;
  ocupado: boolean;
  aoPausar: () => void;
  aoEditar: () => void;
  aoApagar: () => void;
}

/** Estado da ultima rodada em uma linha: o painel nunca diz "tudo certo" sem saber. */
function estado(v: VigilanciaNaTela): { texto: string; alerta: boolean } {
  if (!v.ativa) return { texto: 'Pausada', alerta: false };
  if (!v.ultimaRodadaEm)
    return { texto: 'Esperando a primeira checagem (o vigia precisa estar ligado)', alerta: false };
  const r = v.ultimaRodadaResultado;
  const quando = `Última checagem ${haQuanto(v.ultimaRodadaEm)}`;
  if (!r) return { texto: quando, alerta: false };
  if (r.itinerarios === 0 && (r.erros > 0 || r.puladasPorTeto > 0)) {
    return { texto: `${quando}: nada encontrado. ${r.ultimoErro ?? ''}`.trim(), alerta: true };
  }
  const voos = `${r.itinerarios} ${r.itinerarios === 1 ? 'voo visto' : 'voos vistos'}`;
  return r.erros > 0
    ? { texto: `${quando} · ${voos} · ${r.erros} erro(s): ${r.ultimoErro ?? ''}`, alerta: true }
    : { texto: `${quando} · ${voos}`, alerta: false };
}

export function CartaoVigilancia({ v, ocupado, aoPausar, aoEditar, aoApagar }: Props) {
  const e = estado(v);
  return (
    <li className="rounded-xl border border-[var(--color-borda)] p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-base font-medium break-words">{v.descricao}</p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            v.ativa
              ? 'bg-[var(--color-destaque)]/10 text-[var(--color-destaque)]'
              : 'bg-[var(--color-superficie)] text-[var(--color-texto-suave)]'
          }`}
        >
          {v.ativa ? 'Ativa' : 'Pausada'}
        </span>
      </div>
      <p className="mt-1 text-sm text-[var(--color-texto-suave)]">
        {v.origens.join(', ')} → {v.destinos.join(', ')} · ida {janela(v.idaDe, v.idaAte)}
        {v.voltaDe && v.voltaAte ? ` · volta ${janela(v.voltaDe, v.voltaAte)}` : ' · só ida'}
        {v.precoAlvoCentavos !== null ? ` · até ${formatarReais(v.precoAlvoCentavos)}` : ''}
      </p>
      <p
        className={`mt-2 text-sm ${e.alerta ? 'text-[var(--color-aviso)]' : 'text-[var(--color-texto-suave)]'}`}
      >
        {e.texto}
      </p>
      {!v.estimativa.cabeNoTeto && (
        <p className="mt-1 text-sm text-[var(--color-aviso)]">
          Até {v.estimativa.consultasPorDia} consultas por dia: passa do teto, parte das rotas fica
          sem checagem.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/rotas/${encodeURIComponent(v.id)}`}
          className="inline-flex min-h-11 items-center rounded-lg border border-[var(--color-borda)] px-4 text-sm font-medium"
        >
          Ver preços
        </Link>
        <button
          type="button"
          disabled={ocupado}
          onClick={aoPausar}
          className="min-h-11 rounded-lg border border-[var(--color-borda)] px-4 text-sm disabled:opacity-60"
        >
          {v.ativa ? 'Pausar' : 'Retomar'}
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={aoEditar}
          className="min-h-11 rounded-lg border border-[var(--color-borda)] px-4 text-sm disabled:opacity-60"
        >
          Editar
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={aoApagar}
          className="min-h-11 rounded-lg border border-[var(--color-borda)] px-4 text-sm text-[var(--color-texto-suave)] disabled:opacity-60"
        >
          Apagar
        </button>
      </div>
    </li>
  );
}
