'use client';

import { useState } from 'react';
import { chamar } from '@/lib/api';

export interface ValoresConfiguracoes {
  toleranciaPct: number;
  silencioInicio: number;
  silencioFim: number;
}

const HORAS = Array.from({ length: 24 }, (_, h) => h);
const hora = (h: number) => `${String(h).padStart(2, '0')}:00`;
const campo =
  'min-h-11 rounded-lg border border-[var(--color-borda)] bg-[var(--color-fundo)] px-3 text-base';

/** Tolerancia para comprar direto (RF-14) e horario silencioso (RF-17). */
export function FormConfiguracoes({ inicial }: { inicial: ValoresConfiguracoes }) {
  const [v, setV] = useState(inicial);
  const [silencio, setSilencio] = useState(inicial.silencioInicio !== -1);
  const [inicioSilencio, setInicioSilencio] = useState(
    inicial.silencioInicio === -1 ? 22 : inicial.silencioInicio,
  );
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);

  async function salvar() {
    setSalvando(true);
    setMensagem(null);
    const corpo = { ...v, silencioInicio: silencio ? inicioSilencio : -1 };
    const r = await chamar('/api/configuracoes', { method: 'PUT', body: JSON.stringify(corpo) });
    setSalvando(false);
    setMensagem(
      r.ok
        ? { texto: 'Salvo. O vigia usa os novos valores na próxima checagem.', erro: false }
        : { texto: r.erro, erro: true },
    );
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        void salvar();
      }}
    >
      <fieldset>
        <legend className="text-lg font-semibold">Comprar direto na companhia</legend>
        <p className="mt-1 max-w-prose text-sm text-[var(--color-texto-suave)]">
          Na companhia você tem 24 h para desistir sem custo e atendimento direto. Se ela custar até
          esse tanto a mais que o mais barato, o Frank destaca ela no Onde comprar.
        </p>
        <label className="mt-3 flex items-center gap-3 text-base">
          Pago até
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={50}
            step={1}
            required
            value={v.toleranciaPct}
            onChange={(e) => setV({ ...v, toleranciaPct: Number(e.target.value) })}
            className={`${campo} w-24`}
          />
          % a mais
        </label>
      </fieldset>

      <fieldset>
        <legend className="text-lg font-semibold">Horário silencioso</legend>
        <p className="mt-1 max-w-prose text-sm text-[var(--color-texto-suave)]">
          Ofertas achadas nesse horário (de Brasília) esperam e chegam juntas quando ele acaba. No
          painel elas aparecem na hora.
        </p>
        <label className="mt-3 flex min-h-11 items-center gap-3 text-base">
          <input
            type="checkbox"
            checked={silencio}
            onChange={(e) => setSilencio(e.target.checked)}
            className="h-5 w-5"
          />
          Não mandar avisos à noite
        </label>
        {silencio && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-base">
            <label className="flex items-center gap-2">
              das
              <select
                value={inicioSilencio}
                onChange={(e) => setInicioSilencio(Number(e.target.value))}
                className={campo}
              >
                {HORAS.map((h) => (
                  <option key={h} value={h}>
                    {hora(h)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              às
              <select
                value={v.silencioFim}
                onChange={(e) => setV({ ...v, silencioFim: Number(e.target.value) })}
                className={campo}
              >
                {HORAS.map((h) => (
                  <option key={h} value={h}>
                    {hora(h)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={salvando}
          className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-destaque)] px-5 text-base font-medium text-white disabled:opacity-60"
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
        {mensagem && (
          <p
            role="status"
            className={`text-sm ${mensagem.erro ? 'text-[var(--color-aviso)]' : 'text-[var(--color-texto-suave)]'}`}
          >
            {mensagem.texto}
          </p>
        )}
      </div>
    </form>
  );
}
