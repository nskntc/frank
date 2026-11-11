import { abrirBanco, type Banco, CHAVES_ESTADO, contarChamadasIa, estadoIa, lerEstado } from '@frank/banco';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ComOrcamento } from './orcamento.js';
import {
  IaIndisponivelError,
  type PedidoIa,
  type ProvedorLLM,
  type RespostaIa,
  RespostaIaInvalidaError,
} from './provedor.js';

const agora = new Date('2026-11-11T12:00:00.000Z');
const pedido: PedidoIa<{ ok: boolean }> = { tarefa: 'avaliar_oferta', sistema: 's', mensagem: 'm', schema: z.object({ ok: z.boolean() }) };

/** Provedor falso: devolve ou lanca, em ordem, o que estiver na fila. */
class Roteiro implements ProvedorLLM {
  readonly nome = 'roteiro';
  chamadas = 0;
  constructor(private readonly passos: (Error | { ok: boolean })[]) {}
  async perguntar<T>(): Promise<RespostaIa<T>> {
    const passo = this.passos[this.chamadas++];
    if (passo instanceof Error) throw passo;
    return { dados: passo as T, duracaoMs: 10 };
  }
}

let db: Banco;
beforeEach(() => {
  db = abrirBanco(':memory:');
});

describe('ComOrcamento', () => {
  it('registra a chamada e devolve a resposta', async () => {
    const ia = new ComOrcamento(new Roteiro([{ ok: true }]), db, { relogio: () => agora });
    await expect(ia.perguntar(pedido)).resolves.toMatchObject({ dados: { ok: true } });
    expect(estadoIa(db).ultimoSucesso).toBe(agora.toISOString());
  });

  it('acima do limite de 24 h nem chama o Claude', async () => {
    const roteiro = new Roteiro([{ ok: true }, { ok: true }]);
    const ia = new ComOrcamento(roteiro, db, { limiteDiario: 1, relogio: () => agora });
    await ia.perguntar(pedido);
    await expect(ia.perguntar(pedido)).rejects.toMatchObject({ motivo: 'orcamento' });
    expect(roteiro.chamadas).toBe(1);
    expect(lerEstado(db, CHAVES_ESTADO.iaIndisponivel)?.valor).toContain('Limite de 1 chamadas');
  });

  it('resposta fora do formato: tenta de novo uma vez so', async () => {
    const roteiro = new Roteiro([new RespostaIaInvalidaError('x'), new RespostaIaInvalidaError('y'), { ok: true }]);
    const ia = new ComOrcamento(roteiro, db, { relogio: () => agora });
    await expect(ia.perguntar(pedido)).rejects.toBeInstanceOf(RespostaIaInvalidaError);
    expect(roteiro.chamadas).toBe(2);
    expect(contarChamadasIa(db, new Date(0))).toBe(2);
  });

  it('a segunda tentativa que da certo e aceita', async () => {
    const ia = new ComOrcamento(new Roteiro([new RespostaIaInvalidaError('x'), { ok: true }]), db, { relogio: () => agora });
    await expect(ia.perguntar(pedido)).resolves.toMatchObject({ dados: { ok: true } });
  });

  it('indisponivel nao tenta de novo, grava o motivo e o apaga quando volta', async () => {
    const roteiro = new Roteiro([new IaIndisponivelError('sem_login', 'Rode "claude" e entre.'), { ok: true }]);
    const ia = new ComOrcamento(roteiro, db, { relogio: () => agora });
    await expect(ia.perguntar(pedido)).rejects.toMatchObject({ motivo: 'sem_login' });
    expect(roteiro.chamadas).toBe(1);
    expect(lerEstado(db, CHAVES_ESTADO.iaIndisponivel)?.valor).toBe('Rode "claude" e entre.');

    await ia.perguntar(pedido);
    expect(lerEstado(db, CHAVES_ESTADO.iaIndisponivel)).toBeNull();
  });

  it('chamadas ao mesmo tempo nao furam o limite (uma por vez)', async () => {
    const roteiro = new Roteiro([{ ok: true }, { ok: true }, { ok: true }]);
    const ia = new ComOrcamento(roteiro, db, { limiteDiario: 2, relogio: () => agora });
    const resultados = await Promise.allSettled([ia.perguntar(pedido), ia.perguntar(pedido), ia.perguntar(pedido)]);
    expect(resultados.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled', 'rejected']);
    expect(roteiro.chamadas).toBe(2);
  });

  it('nunca grava o texto do pedido', async () => {
    const ia = new ComOrcamento(new Roteiro([{ ok: true }]), db, { relogio: () => agora });
    await ia.perguntar({ ...pedido, mensagem: 'SEGREDO-DO-PEDIDO' });
    const tudo = JSON.stringify(db.prepare('SELECT * FROM chamadas_ia').all());
    expect(tudo).not.toContain('SEGREDO-DO-PEDIDO');
  });
});
