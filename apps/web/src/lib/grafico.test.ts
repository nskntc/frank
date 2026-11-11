import { describe, expect, it } from 'vitest';
import { escala, faixaDePreco, maisProximo, marcasDeDias } from './grafico';

describe('escala', () => {
  it('leva o valor ao pixel, inclusive invertida (eixo y)', () => {
    const y = escala(0, 100, 200, 0);
    expect(y.px(0)).toBe(200);
    expect(y.px(100)).toBe(0);
    expect(y.px(50)).toBe(100);
  });
});

describe('faixaDePreco', () => {
  it('arredonda para marcas redondas que cobrem todos os valores', () => {
    const f = faixaDePreco([71_415, 115_000, 80_000]);
    expect(f.min).toBeLessThanOrEqual(71_415);
    expect(f.max).toBeGreaterThanOrEqual(115_000);
    expect(f.marcas.at(0)).toBe(f.min);
    expect(f.marcas.at(-1)).toBe(f.max);
    expect(f.marcas.every((m) => m % 1_000 === 0)).toBe(true);
  });

  it('um valor so ainda vira uma faixa', () => {
    const f = faixaDePreco([50_000]);
    expect(f.min).toBeLessThan(50_000);
    expect(f.max).toBeGreaterThan(50_000);
  });

  it('nunca negativa e vazia nao quebra', () => {
    expect(faixaDePreco([1, 2]).min).toBeGreaterThanOrEqual(0);
    expect(faixaDePreco([]).marcas).toEqual([]);
  });
});

describe('maisProximo', () => {
  it('acha o indice mais perto', () => {
    expect(maisProximo([10, 20, 30], 24)).toBe(1);
    expect(maisProximo([10, 20, 30], 26)).toBe(2);
    expect(maisProximo([10, 20, 30], -5)).toBe(0);
    expect(maisProximo([10, 20, 30], 99)).toBe(2);
    expect(maisProximo([], 1)).toBe(-1);
  });
});

describe('marcasDeDias', () => {
  it('poe no maximo a quantidade pedida, em dias inteiros', () => {
    const DIA = 86_400_000;
    const inicio = Date.UTC(2027, 0, 1, 15);
    const marcas = marcasDeDias(inicio, inicio + 30 * DIA, 5);
    expect(marcas.length).toBeLessThanOrEqual(6);
    expect(marcas.every((t) => t % DIA === 0)).toBe(true);
    expect(marcas.at(0)).toBeGreaterThanOrEqual(inicio);
  });
});
