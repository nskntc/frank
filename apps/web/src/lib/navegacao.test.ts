import { describe, expect, it } from 'vitest';
import { itemAtivo, NAVEGACAO } from './navegacao';

describe('itemAtivo', () => {
  it('a raiz so casa com ela mesma', () => {
    expect(itemAtivo('/', '/')).toBe(true);
    expect(itemAtivo('/rotas', '/')).toBe(false);
  });

  it('casa com o detalhe de uma rota', () => {
    expect(itemAtivo('/rotas/sao-rec', '/rotas')).toBe(true);
  });

  it('nao confunde prefixo de palavra', () => {
    expect(itemAtivo('/rotasx', '/rotas')).toBe(false);
  });
});

describe('NAVEGACAO', () => {
  it('comeca pelas Ofertas', () => {
    expect(NAVEGACAO[0]).toEqual({ href: '/', rotulo: 'Ofertas' });
  });
});
