import { describe, expect, it } from 'vitest';
import { mediana } from './estatistica.js';

describe('mediana', () => {
  it('pega o valor do meio numa lista impar', () => {
    expect(mediana([300, 100, 200])).toBe(200);
  });

  it('faz a media dos dois do meio numa lista par', () => {
    expect(mediana([100, 200, 300, 400])).toBe(250);
  });

  it('devolve null sem dados', () => {
    expect(mediana([])).toBeNull();
  });

  it('nao altera a lista recebida', () => {
    const lista = [3, 1, 2];
    mediana(lista);
    expect(lista).toEqual([3, 1, 2]);
  });
});
