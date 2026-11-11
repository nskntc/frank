import { describe, expect, it } from 'vitest';
import { pedidoDoPainel } from './origem';

const h = (valores: Record<string, string>) => new Headers(valores);

describe('pedidoDoPainel', () => {
  it('aceita o proprio painel', () => {
    expect(pedidoDoPainel(h({ host: '127.0.0.1:4321', origin: 'http://127.0.0.1:4321' }))).toBe(
      true,
    );
    expect(pedidoDoPainel(h({ host: '127.0.0.1:4321', 'sec-fetch-site': 'same-origin' }))).toBe(
      true,
    );
  });

  it('recusa outra pagina aberta no navegador', () => {
    expect(
      pedidoDoPainel(h({ host: '127.0.0.1:4321', origin: 'https://site-qualquer.example' })),
    ).toBe(false);
    expect(pedidoDoPainel(h({ host: '127.0.0.1:4321', 'sec-fetch-site': 'cross-site' }))).toBe(
      false,
    );
    expect(pedidoDoPainel(h({ host: '127.0.0.1:4321' }))).toBe(false);
  });

  it('recusa dominio de fora apontando para o endereco local (DNS rebinding)', () => {
    expect(
      pedidoDoPainel(h({ host: 'ataque.example:4321', origin: 'http://ataque.example:4321' })),
    ).toBe(false);
  });
});
