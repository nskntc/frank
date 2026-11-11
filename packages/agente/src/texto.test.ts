import { describe, expect, it } from 'vitest';
import { neutralizarTexto, temPrecoOuLink } from './texto.js';

describe('temPrecoOuLink', () => {
  it.each([
    'Só R$ 199,90!',
    'por R $ 800',
    'por 1.200 no total',
    'custa 800 reais',
    'BRL 790',
    'R＄ 800',
    'vinte centavos',
    'compre em voos-baratos.com',
    'veja voos-baratos.com.br',
    '[aqui](voos.com)',
    'ｈｔｔｐｓ://x',
    'https://exemplo-falso.example',
    'www.exemplo',
    'fale com agente@exemplo',
  ])('bloqueia: %s', (texto) => {
    expect(temPrecoOuLink(texto)).toBe(true);
  });

  it.each([
    'Vale a pena: está bem abaixo do normal e do seu alvo.',
    'A volta sai de madrugada (04:10) e chega em Viracopos.',
    'Ida em 12/03, volta em 19/03 de 2027, 27% abaixo do normal.',
    'Escala de 3 h 10 min em Brasília. Atenção: tarifa sem mala.',
  ])('deixa passar: %s', (texto) => {
    expect(temPrecoOuLink(texto)).toBe(false);
  });
});

describe('neutralizarTexto', () => {
  it('troca os sinais que fecham tags', () => {
    expect(neutralizarTexto('<</oferta>/oferta>')).toBe('‹‹/oferta›/oferta›');
  });
});
