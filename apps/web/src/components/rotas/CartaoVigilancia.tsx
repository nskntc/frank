import { formatarReais } from '@frank/dominio';
import Link from 'next/link';
import { descreverRodizio, emHoras } from '@/lib/estimativa';
import { AvisoSemVoos } from '@/components/rota/AvisoSemVoos';
import { janela } from '@/lib/formatar';
import { situacaoDaRota, type Situacao } from '@/lib/situacao';
import type { VigilanciaNaTela } from './tipos';

interface Props {
  v: VigilanciaNaTela;
  ocupado: boolean;
  aoPausar: () => void;
  aoEditar: () => void;
  aoApagar: () => void;
}

/** Estado da ultima rodada em uma linha: o painel nunca diz "tudo certo" sem saber. */
function estado(s: Situacao): { texto: string; alerta: boolean } | null {
  switch (s.tipo) {
    case 'pausada':
      return { texto: 'Pausada', alerta: false };
    case 'nunca_rodou':
      return {
        texto: 'Esperando a primeira checagem (o vigia precisa estar ligado)',
        alerta: false,
      };
    case 'falhou':
      return { texto: `Última checagem ${s.quando}: falhou. ${s.erro ?? ''}`.trim(), alerta: true };
    case 'sem_voos':
      return null; // AvisoSemVoos
    case 'ok': {
      const quando = `Última checagem ${s.quando}`;
      const voos = `${s.voos} ${s.voos === 1 ? 'voo visto' : 'voos vistos'}`;
      return s.erros > 0
        ? { texto: `${quando} · ${voos} · ${s.erros} erro(s): ${s.erro ?? ''}`, alerta: true }
        : { texto: `${quando} · ${voos}`, alerta: false };
    }
  }
}

export function CartaoVigilancia({ v, ocupado, aoPausar, aoEditar, aoApagar }: Props) {
  const s = situacaoDaRota(v, v.jaAchouVoo);
  const e = estado(s);
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
      {e && (
        <p
          className={`mt-2 text-sm ${e.alerta ? 'text-[var(--color-aviso)]' : 'text-[var(--color-texto-suave)]'}`}
        >
          {e.texto}
        </p>
      )}
      {s.tipo === 'sem_voos' && <AvisoSemVoos s={s} compacto />}
      {v.estimativa.ajustado && (
        <p className="mt-1 text-sm text-[var(--color-texto-suave)]">
          Rota ampla: o Frank reveza, {descreverRodizio(v.estimativa)}
          {v.estimativa.intervaloMinutos !== v.intervaloMinutos
            ? `, checando a cada ${emHoras(v.estimativa.intervaloMinutos)}`
            : ''}
          .
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
