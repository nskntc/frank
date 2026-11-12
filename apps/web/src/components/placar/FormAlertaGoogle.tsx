'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { chamar } from '@/lib/api';
import { lerReais } from '@/lib/placar';

const campo =
  'min-h-11 w-full rounded-lg border border-[var(--color-borda)] bg-[var(--color-fundo)] px-3 text-base';

interface Props {
  vigilanciaId: string;
  /** Hoje em Brasilia (AAAA-MM-DD): o padrao do campo de data. */
  hoje: string;
}

/** Registrar a mao o alerta de preco que chegou do Google Flights (RF-20). */
export function FormAlertaGoogle({ vigilanciaId, hoje }: Props) {
  const router = useRouter();
  const [data, setData] = useState(hoje);
  const [hora, setHora] = useState('');
  const [preco, setPreco] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    const precoReais = lerReais(preco);
    if (precoReais === null) {
      setErro('Escreva o preço como no e-mail, por exemplo 1.234,56.');
      return;
    }
    setSalvando(true);
    setErro(null);
    const r = await chamar('/api/placar', {
      method: 'POST',
      body: JSON.stringify({
        vigilanciaId,
        data,
        hora,
        precoReais,
        confirmado,
        observacao: observacao.trim() || null,
      }),
    });
    setSalvando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    setHora('');
    setPreco('');
    setConfirmado(false);
    setObservacao('');
    router.refresh();
  }

  const id = (nome: string) => `${nome}-${vigilanciaId}`;
  return (
    <form
      className="mt-4 rounded-lg border border-[var(--color-borda)] bg-[var(--color-superficie)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void salvar();
      }}
    >
      <p className="text-base font-medium">Chegou alerta do Google?</p>
      <p className="mt-1 text-sm text-[var(--color-texto-suave)]">
        Use a hora em que o e-mail chegou (horário de Brasília) e o preço que ele mostra.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <label htmlFor={id('data')} className="text-sm">
          Dia
          <input
            id={id('data')}
            type="date"
            required
            max={hoje}
            value={data}
            onChange={(e) => setData(e.target.value)}
            className={`${campo} mt-1`}
          />
        </label>
        <label htmlFor={id('hora')} className="text-sm">
          Hora
          <input
            id={id('hora')}
            type="time"
            required
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className={`${campo} mt-1`}
          />
        </label>
        <label htmlFor={id('preco')} className="text-sm">
          Preço (R$)
          <input
            id={id('preco')}
            type="text"
            inputMode="decimal"
            required
            placeholder="1.234,56"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            className={`${campo} mt-1 tabular-nums`}
          />
        </label>
        <label htmlFor={id('obs')} className="text-sm">
          Observação <span className="text-[var(--color-texto-suave)]">(opcional)</span>
          <input
            id={id('obs')}
            type="text"
            maxLength={300}
            placeholder="ex.: Gol, com escala"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className={`${campo} mt-1`}
          />
        </label>
      </div>
      <label className="mt-3 flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={confirmado}
          onChange={(e) => setConfirmado(e.target.checked)}
          className="h-5 w-5 shrink-0"
        />
        Conferi esse preço até a tela de pagamento
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={salvando}
          className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-destaque)] px-5 text-base font-medium text-white disabled:opacity-60"
        >
          {salvando ? 'Registrando...' : 'Registrar alerta'}
        </button>
        {erro && (
          <p role="alert" className="text-sm text-[var(--color-aviso)]">
            {erro}
          </p>
        )}
      </div>
    </form>
  );
}
