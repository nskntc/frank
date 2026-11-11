'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { chamar } from '@/lib/api';
import { CartaoPlano } from './CartaoPlano';
import { CartaoVigilancia } from './CartaoVigilancia';
import type { Plano, VigilanciaNaTela } from './tipos';

interface Erro {
  erro: string;
  problemas?: string[];
}

/** Tela Rotas vigiadas (RF-01 a RF-03): pedido em texto livre, conferencia e a lista. */
export function PainelRotas() {
  const [pedido, setPedido] = useState('');
  const [plano, setPlano] = useState<Plano | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [vigilancias, setVigilancias] = useState<VigilanciaNaTela[] | null>(null);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [erro, setErro] = useState<Erro | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  const carregar = useCallback(async () => {
    const r = await chamar<VigilanciaNaTela[]>('/api/vigilancias');
    if (r.ok) setVigilancias(r.dados);
    else setErro({ erro: r.erro });
  }, []);

  // Carrega ao abrir e a cada minuto (o vigia atualiza o estado a cada tique).
  useEffect(() => {
    let viva = true;
    const buscar = () =>
      chamar<VigilanciaNaTela[]>('/api/vigilancias').then((r) => {
        if (!viva) return;
        if (r.ok) setVigilancias(r.dados);
        else setErro({ erro: r.erro });
      });
    void buscar();
    const relogio = setInterval(() => void buscar(), 60_000);
    return () => {
      viva = false;
      clearInterval(relogio);
    };
  }, []);

  async function entender() {
    setErro(null);
    setPlano(null);
    setLendo(true);
    const r = await chamar<Plano>('/api/vigilancias/planejar', { method: 'POST', body: JSON.stringify({ pedido }) });
    setLendo(false);
    if (r.ok) setPlano(r.dados);
    else setErro({ erro: r.erro, problemas: r.problemas });
  }

  async function salvar() {
    if (!plano) return;
    setSalvando(true);
    const r = await chamar(editandoId ? `/api/vigilancias/${editandoId}` : '/api/vigilancias', {
      method: editandoId ? 'PUT' : 'POST',
      body: JSON.stringify({ vigilancia: plano.vigilancia }),
    });
    setSalvando(false);
    if (!r.ok) {
      setErro({ erro: r.erro, problemas: r.problemas });
      return;
    }
    setPlano(null);
    setPedido('');
    setEditandoId(null);
    await carregar();
  }

  async function alternar(v: VigilanciaNaTela) {
    setOcupadoId(v.id);
    const r = await chamar(`/api/vigilancias/${v.id}`, { method: 'PATCH', body: JSON.stringify({ ativa: !v.ativa }) });
    setOcupadoId(null);
    if (!r.ok) setErro({ erro: r.erro });
    await carregar();
  }

  async function apagar(v: VigilanciaNaTela) {
    if (!window.confirm(`Apagar "${v.descricao}"? O histórico de preços e as ofertas dela também somem.`)) return;
    setOcupadoId(v.id);
    const r = await chamar(`/api/vigilancias/${v.id}`, { method: 'DELETE' });
    setOcupadoId(null);
    if (!r.ok) setErro({ erro: r.erro });
    await carregar();
  }

  function editar(v: VigilanciaNaTela) {
    setEditandoId(v.id);
    setPedido(v.descricao);
    setPlano(null);
    setErro(null);
    campo.current?.focus();
    campo.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setPedido('');
    setPlano(null);
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Rotas vigiadas</h1>

      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (pedido.trim() && !lendo) void entender();
        }}
      >
        <label htmlFor="pedido" className="text-base font-medium">
          {editandoId ? 'Descreva de novo a viagem, já corrigida' : 'Para onde você quer ir?'}
        </label>
        <textarea
          id="pedido"
          ref={campo}
          value={pedido}
          onChange={(e) => setPedido(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="São Paulo → Recife, qualquer dia de março, até R$ 800"
          className="mt-2 w-full rounded-lg border border-[var(--color-borda)] bg-[var(--color-fundo)] p-3 text-base"
        />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={!pedido.trim() || lendo}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--color-destaque)] px-5 text-base font-medium text-white disabled:opacity-60"
          >
            {lendo ? 'O Claude está lendo...' : 'Entender pedido'}
          </button>
          {editandoId && (
            <button type="button" onClick={cancelarEdicao} className="min-h-11 rounded-lg border border-[var(--color-borda)] px-5 text-base">
              Cancelar edição
            </button>
          )}
          <p className="text-sm text-[var(--color-texto-suave)]">Nada é salvo antes de você conferir.</p>
        </div>
      </form>

      {erro && (
        <div role="alert" className="mt-6 rounded-lg border border-[var(--color-aviso)] p-4 text-sm">
          <p className="font-medium">{erro.erro}</p>
          {erro.problemas && erro.problemas.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-[var(--color-texto-suave)]">
              {erro.problemas.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {plano && (
        <CartaoPlano
          plano={plano}
          salvando={salvando}
          editando={editandoId !== null}
          aoSalvar={() => void salvar()}
          aoCorrigir={() => campo.current?.focus()}
        />
      )}

      <section aria-label="Vigilâncias" className="mt-10">
        <h2 className="text-lg font-semibold">Suas vigilâncias</h2>
        {vigilancias === null ? (
          <p className="mt-3 text-sm text-[var(--color-texto-suave)]">Carregando...</p>
        ) : vigilancias.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-texto-suave)]">
            Nenhuma ainda. Descreva uma viagem acima e o Frank começa a vigiar.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {vigilancias.map((v) => (
              <CartaoVigilancia
                key={v.id}
                v={v}
                ocupado={ocupadoId === v.id}
                aoPausar={() => void alternar(v)}
                aoEditar={() => editar(v)}
                aoApagar={() => void apagar(v)}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
