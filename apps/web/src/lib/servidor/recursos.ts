import 'server-only';
import { abrirBanco, type Banco, caminhoDoBanco } from '@frank/banco';
import { ClaudeCli, ComOrcamento, type ProvedorLLM } from '@frank/ia';

/**
 * Banco e Claude do painel, um de cada por processo (o Next recarrega modulos em dev: o cache
 * fica no globalThis). O banco e o mesmo arquivo que o vigia usa (data/frank.db na raiz).
 */
const cache = globalThis as unknown as { frankBanco?: Banco; frankIa?: ProvedorLLM };

export function banco(): Banco {
  cache.frankBanco ??= abrirBanco(caminhoDoBanco());
  return cache.frankBanco;
}

export function ia(): ProvedorLLM {
  const modelo = process.env.FRANK_MODELO;
  const limite = Number(process.env.FRANK_LIMITE_DIARIO_IA || '30');
  cache.frankIa ??= new ComOrcamento(new ClaudeCli(modelo ? { modelo } : {}), banco(), {
    limiteDiario: Number.isInteger(limite) && limite > 0 ? limite : 30,
  });
  return cache.frankIa;
}
