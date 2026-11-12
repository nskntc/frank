import type { Perna } from '@frank/contratos';
import { duracao, horario } from '@/lib/formatar';

/** Uma perna do voo (ida ou volta): horarios com dia da semana, companhias, escalas e duracao. */
export function Trecho({ nome, p }: { nome: string; p: Perna }) {
  const companhias = [...new Set(p.trechos.map((t) => t.companhia))].join(', ');
  const paradas = p.trechos.slice(0, -1).map((t) => t.para);
  const escalas =
    p.escalas === 0
      ? 'direto'
      : `${p.escalas} ${p.escalas === 1 ? 'escala' : 'escalas'} (${paradas.join(', ')})`;
  return (
    <div className="grid grid-cols-[3.5rem_1fr] gap-x-3 text-sm">
      <span className="text-[var(--color-texto-suave)]">{nome}</span>
      <div className="min-w-0">
        <p className="font-medium">
          {p.de} {horario(p.partida)} → {p.para} {horario(p.chegada)}
        </p>
        <p className="break-words text-[var(--color-texto-suave)]">
          {companhias} · {escalas} · {duracao(p.duracaoSegundos)}
        </p>
      </div>
    </div>
  );
}
