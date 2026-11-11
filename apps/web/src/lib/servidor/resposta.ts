import { NextResponse } from 'next/server';

/** Resposta unica da API local: { ok: true, dados } ou { ok: false, erro } (texto para a tela). */
export function ok<T>(dados: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, dados }, { status });
}

export function falha(erro: string, status: number, problemas?: string[]): NextResponse {
  return NextResponse.json({ ok: false, erro, ...(problemas ? { problemas } : {}) }, { status });
}

export const recusado = () => falha('Pedido recusado: só o próprio painel do Frank pode fazer isso.', 403);
