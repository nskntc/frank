import { describe, expect, it } from 'vitest';
import { avaliacaoOfertaSchema } from './avaliacao.js';

const valida = {
  valeAPena: true,
  pegadinhas: [{ tipo: 'outro_aeroporto', descricao: 'A volta chega em Viracopos.' }],
  resumo: 'Voo direto, 25% abaixo do normal.',
};

describe('avaliacaoOfertaSchema', () => {
  it('aceita a avaliacao esperada', () => {
    expect(avaliacaoOfertaSchema.parse(valida)).toEqual(valida);
  });

  it('recusa campo de preco vindo do modelo', () => {
    expect(() => avaliacaoOfertaSchema.parse({ ...valida, precoCentavos: 100 })).toThrow();
  });

  it('recusa tipo de pegadinha desconhecido', () => {
    const invalida = { ...valida, pegadinhas: [{ tipo: 'qualquer', descricao: 'x' }] };
    expect(() => avaliacaoOfertaSchema.parse(invalida)).toThrow();
  });
});
