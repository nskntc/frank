import { describe, expect, it } from 'vitest';
import { detectarOferta, precoNormal } from './detector.js';

describe('precoNormal', () => {
  it('usa a mediana quando ha observacoes suficientes', () => {
    expect(precoNormal([100_000, 120_000, 110_000], 3)).toBe(110_000);
  });

  it('devolve null com historico curto demais', () => {
    expect(precoNormal([100_000, 120_000], 3)).toBeNull();
  });

  it('exige 20 observacoes por padrao', () => {
    expect(precoNormal(Array.from({ length: 19 }, () => 100_000))).toBeNull();
    expect(precoNormal(Array.from({ length: 20 }, () => 100_000))).toBe(100_000);
  });
});

describe('detectarOferta', () => {
  it('e oferta quando o preco fica no preco-alvo ou abaixo', () => {
    const r = detectarOferta({ precoFinal: 80_000, precoAlvo: 80_000 });
    expect(r).toEqual({ ehOferta: true, motivos: ['abaixo_do_alvo'], percentualAbaixo: null });
  });

  it('e oferta quando fica 25% ou mais abaixo do normal', () => {
    const r = detectarOferta({ precoFinal: 81_750, precoNormal: 109_000 });
    expect(r.ehOferta).toBe(true);
    expect(r.motivos).toEqual(['abaixo_do_normal']);
    expect(r.percentualAbaixo).toBe(25);
  });

  it('nao e oferta a 24% abaixo do normal e acima do alvo', () => {
    const r = detectarOferta({ precoFinal: 82_840, precoNormal: 109_000, precoAlvo: 80_000 });
    expect(r.ehOferta).toBe(false);
    expect(r.percentualAbaixo).toBe(24);
  });

  it('respeita o percentual configurado', () => {
    const r = detectarOferta({
      precoFinal: 98_100,
      precoNormal: 109_000,
      percentualAbaixoDoNormal: 10,
    });
    expect(r.ehOferta).toBe(true);
  });

  it('junta os dois motivos', () => {
    const r = detectarOferta({ precoFinal: 60_000, precoAlvo: 80_000, precoNormal: 109_000 });
    expect(r.motivos).toEqual(['abaixo_do_alvo', 'abaixo_do_normal']);
  });

  it('preco acima do normal da percentual negativo e nao e oferta', () => {
    const r = detectarOferta({ precoFinal: 120_000, precoNormal: 100_000 });
    expect(r).toEqual({ ehOferta: false, motivos: [], percentualAbaixo: -20 });
  });
});
