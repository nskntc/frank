'use client';

import { formatarReais } from '@frank/dominio';
import { useEffect, useMemo, useRef, useState } from 'react';
import { escala, faixaDePreco, maisProximo, marcasDeDias } from '@/lib/grafico';
import type { Ponto } from '@/lib/rota';

interface Props {
  frank: Ponto[];
  google: Ponto[];
  normalCentavos: number | null;
  alvoCentavos: number | null;
}

const ALTURA = 280;
const MARGEM = { topo: 16, direita: 16, baixo: 28, esquerda: 64 };
const BRASILIA_MS = 3 * 3_600_000;
const DIA_MS = 86_400_000;

const fmtDia = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
});
const fmtQuando = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
const fmtDiaSemana = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

/** "R$ 1.200" no eixo: sem centavos, que so poluem. */
function reaisCurto(centavos: number): string {
  return formatarReais(Math.round(centavos / 100) * 100).replace(/,00$/, '');
}

function caminho(pontos: Ponto[], x: (t: number) => number, y: (v: number) => number): string {
  return pontos
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.precoCentavos).toFixed(1)}`)
    .join('');
}

/**
 * Grafico de linha do preco da rota (RF-18): menor preco de cada checagem do Frank e a
 * referencia diaria do Google, com o preco normal e o preco-alvo como linhas de referencia.
 * Um eixo so (reais). Passar o dedo/mouse mostra os valores do ponto mais proximo.
 */
export function GraficoPreco({ frank, google: googleTodo, normalCentavos, alvoCentavos }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const [foco, setFoco] = useState<number | null>(null);
  const [periodo, setPeriodo] = useState<'frank' | 'tudo'>('frank');

  // O Google traz 60 dias; o Frank, so desde que vigia. Por padrao o grafico comeca no Frank, para
  // as checagens nao ficarem espremidas num canto (no celular, sobretudo).
  const inicioFrank = frank.length >= 2 ? frank[0]?.t : undefined;
  const podeRecortar =
    inicioFrank !== undefined && googleTodo.some((p) => p.t < inicioFrank - DIA_MS);
  const google = useMemo(
    () =>
      podeRecortar && periodo === 'frank' && inicioFrank !== undefined
        ? googleTodo.filter((p) => p.t >= inicioFrank - DIA_MS)
        : googleTodo,
    [googleTodo, podeRecortar, periodo, inicioFrank],
  );

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = new ResizeObserver(([e]) => setLargura(Math.floor(e?.contentRect.width ?? 0)));
    medir.observe(el);
    return () => medir.disconnect();
  }, []);

  const g = useMemo(() => {
    const todos = [...frank, ...google];
    const ts = todos.map((p) => p.t);
    const tMin = Math.min(...ts);
    const tMax = Math.max(...ts, tMin + DIA_MS);
    const valores = todos.map((p) => p.precoCentavos);
    if (normalCentavos !== null) valores.push(normalCentavos);
    if (alvoCentavos !== null) valores.push(alvoCentavos);
    const faixa = faixaDePreco(valores);
    const larguraUtil = Math.max(largura, 1);
    const x = escala(tMin, tMax, MARGEM.esquerda, larguraUtil - MARGEM.direita);
    const y = escala(faixa.min, faixa.max, ALTURA - MARGEM.baixo, MARGEM.topo);
    const quantasDatas = Math.max(2, Math.floor((larguraUtil - MARGEM.esquerda) / 90));
    return {
      x,
      y,
      faixa,
      datas: marcasDeDias(tMin, tMax, quantasDatas, BRASILIA_MS),
      tsFrank: frank.map((p) => p.t),
    };
  }, [frank, google, normalCentavos, alvoCentavos, largura]);

  // O foco e um instante: o ponto do Frank mais perto e a referencia do Google do mesmo dia.
  const pontoFrank = foco === null ? undefined : frank[maisProximo(g.tsFrank, foco)];
  const instanteFoco = pontoFrank?.t ?? foco;
  const pontoGoogle =
    instanteFoco === null || instanteFoco === undefined
      ? undefined
      : google.find((p) => Math.abs(p.t - instanteFoco) < DIA_MS / 2);

  function mover(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const t =
      g.x.min +
      ((px - MARGEM.esquerda) / (r.width - MARGEM.esquerda - MARGEM.direita)) * (g.x.max - g.x.min);
    setFoco(Math.min(g.x.max, Math.max(g.x.min, t)));
  }

  const linhaRef = (valor: number | null, tracejado: string) =>
    valor === null ? null : (
      <line
        x1={MARGEM.esquerda}
        x2={largura - MARGEM.direita}
        y1={g.y.px(valor)}
        y2={g.y.px(valor)}
        stroke="var(--color-texto-suave)"
        strokeWidth={1.5}
        strokeDasharray={tracejado}
      />
    );

  // Rotulo desenhado depois das series: o contorno da cor do fundo corta a linha que passa por baixo.
  const rotuloRef = (valor: number | null, rotulo: string) =>
    valor === null ? null : (
      <text
        x={largura - MARGEM.direita}
        y={g.y.px(valor) - 6}
        textAnchor="end"
        className="fill-[var(--color-texto-suave)] text-[11px]"
        paintOrder="stroke"
        stroke="var(--color-fundo)"
        strokeWidth={4}
      >
        {rotulo} {reaisCurto(valor)}
      </text>
    );

  const xFoco = instanteFoco !== null && instanteFoco !== undefined ? g.x.px(instanteFoco) : null;

  return (
    <figure className="mt-4">
      {podeRecortar && (
        <div
          className="mb-3 inline-flex rounded-lg border border-[var(--color-borda)] p-0.5 text-sm"
          role="group"
          aria-label="Período"
        >
          {(
            [
              ['frank', 'Desde que o Frank vigia'],
              ['tudo', '60 dias'],
            ] as const
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              aria-pressed={periodo === valor}
              onClick={() => setPeriodo(valor)}
              className={`min-h-10 rounded-md px-3 ${periodo === valor ? 'bg-[var(--color-superficie)] font-medium' : 'text-[var(--color-texto-suave)]'}`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      )}
      <ul
        className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[var(--color-texto-suave)]"
        aria-label="Legenda"
      >
        {frank.length > 0 && (
          <li className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-5 rounded bg-[var(--serie-1)]" aria-hidden />
            Frank: menor preço de cada checagem
          </li>
        )}
        {google.length > 0 && (
          <li className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-5 rounded bg-[var(--serie-2)]" aria-hidden />
            Google Flights: referência do dia
          </li>
        )}
        {(normalCentavos !== null || alvoCentavos !== null) && (
          <li className="flex items-center gap-2">
            <span
              className="inline-block w-5 border-t-2 border-dashed border-[var(--color-texto-suave)]"
              aria-hidden
            />
            {normalCentavos !== null && alvoCentavos !== null
              ? 'Preço normal e preço-alvo'
              : normalCentavos !== null
                ? 'Preço normal'
                : 'Preço-alvo'}
          </li>
        )}
      </ul>

      <div ref={caixa} className="relative w-full" style={{ height: ALTURA }}>
        {largura > 0 && (
          <svg
            width={largura}
            height={ALTURA}
            role="img"
            aria-label="Gráfico do preço da rota ao longo do tempo. Os valores estão na tabela abaixo."
            onPointerMove={mover}
            onPointerDown={mover}
            onPointerLeave={() => setFoco(null)}
            className="touch-pan-y select-none"
          >
            {g.faixa.marcas.map((m) => (
              <g key={m}>
                <line
                  x1={MARGEM.esquerda}
                  x2={largura - MARGEM.direita}
                  y1={g.y.px(m)}
                  y2={g.y.px(m)}
                  stroke="var(--color-borda)"
                  strokeWidth={1}
                />
                <text
                  x={MARGEM.esquerda - 8}
                  y={g.y.px(m) + 4}
                  textAnchor="end"
                  className="fill-[var(--color-texto-suave)] text-[11px] tabular-nums"
                >
                  {reaisCurto(m)}
                </text>
              </g>
            ))}
            {g.datas.map((t) => (
              <text
                key={t}
                x={g.x.px(t)}
                y={ALTURA - 8}
                textAnchor="middle"
                className="fill-[var(--color-texto-suave)] text-[11px] tabular-nums"
              >
                {fmtDia.format(t)}
              </text>
            ))}

            {linhaRef(normalCentavos, '6 4')}
            {linhaRef(alvoCentavos, '2 4')}

            {google.length > 1 && (
              <path
                d={caminho(google, g.x.px, g.y.px)}
                fill="none"
                stroke="var(--serie-2)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {frank.length > 1 && (
              <path
                d={caminho(frank, g.x.px, g.y.px)}
                fill="none"
                stroke="var(--serie-1)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {frank.length === 1 && frank[0] && (
              <circle
                cx={g.x.px(frank[0].t)}
                cy={g.y.px(frank[0].precoCentavos)}
                r={4}
                fill="var(--serie-1)"
                stroke="var(--color-fundo)"
                strokeWidth={2}
              />
            )}
            {rotuloRef(normalCentavos, 'normal')}
            {rotuloRef(alvoCentavos, 'alvo')}

            {xFoco !== null && (
              <g pointerEvents="none">
                <line
                  x1={xFoco}
                  x2={xFoco}
                  y1={MARGEM.topo}
                  y2={ALTURA - MARGEM.baixo}
                  stroke="var(--color-texto-suave)"
                  strokeWidth={1}
                />
                {pontoFrank && (
                  <circle
                    cx={g.x.px(pontoFrank.t)}
                    cy={g.y.px(pontoFrank.precoCentavos)}
                    r={5}
                    fill="var(--serie-1)"
                    stroke="var(--color-fundo)"
                    strokeWidth={2}
                  />
                )}
                {pontoGoogle && (
                  <circle
                    cx={g.x.px(pontoGoogle.t)}
                    cy={g.y.px(pontoGoogle.precoCentavos)}
                    r={5}
                    fill="var(--serie-2)"
                    stroke="var(--color-fundo)"
                    strokeWidth={2}
                  />
                )}
              </g>
            )}
          </svg>
        )}

        {xFoco !== null && (pontoFrank || pontoGoogle) && (
          <div
            role="status"
            className="pointer-events-none absolute top-2 rounded-lg border border-[var(--color-borda)] bg-[var(--color-fundo)] px-3 py-2 text-xs shadow-sm"
            style={xFoco > largura / 2 ? { right: largura - xFoco + 12 } : { left: xFoco + 12 }}
          >
            {pontoFrank && (
              <p>
                <span className="text-[var(--color-texto-suave)]">
                  {fmtQuando.format(pontoFrank.t)} · Frank{' '}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatarReais(pontoFrank.precoCentavos)}
                </span>
              </p>
            )}
            {pontoGoogle && (
              <p>
                <span className="text-[var(--color-texto-suave)]">
                  {fmtDiaSemana.format(pontoGoogle.t)} · Google{' '}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatarReais(pontoGoogle.precoCentavos)}
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </figure>
  );
}
