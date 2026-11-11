import { abrirBanco, type Banco, descartarOferta } from '@frank/banco';
import { beforeEach, describe, expect, it } from 'vitest';
import { linkSeguro, ofertasParaTela } from './ofertas';
import { semearExemplos } from './teste/exemplo';

const HOJE = new Date('2027-01-10T12:00:00Z');
let db: Banco;
let ids: number[];

beforeEach(() => {
  db = abrirBanco(':memory:');
  ids = semearExemplos(db, HOJE);
});

describe('ofertasParaTela', () => {
  it('lista da mais barata para a mais cara', () => {
    const precos = ofertasParaTela(db, HOJE).map((o) => o.itinerario.precoCentavos);
    expect(precos).toEqual([38_990, 69_000, 92_000]);
  });

  it('destaca a companhia dentro da tolerancia, com as 24 h para desistir', () => {
    const o = ofertasParaTela(db, HOJE).find((x) => x.id === ids[0]);
    expect(o?.companhiaNaTolerancia).toBe(true);
    const destaque = o?.compras[o.destacado];
    expect(destaque?.vendedor).toBe('Companhia Exemplo');
    expect(destaque?.etiquetas).toContain('24h_para_desistir');
    expect(o?.precoCentavos).toBe(destaque?.precoFinalCentavos);
  });

  it('sem Onde comprar gravado, usa o link da fonte ao preco da oferta', () => {
    const o = ofertasParaTela(db, HOJE).find((x) => x.id === ids[1]);
    expect(o?.compras).toEqual([
      {
        vendedor: 'Kiwi.com',
        precoFinalCentavos: 40_355,
        ehCompanhia: false,
        etiquetas: ['empresa_estrangeira'],
        link: 'https://www.kiwi.com/u/exemplo-2',
      },
    ]);
    expect(o?.destacado).toBe(0);
  });

  it('sem avaliacao do Claude, mostra as pegadinhas que o codigo detecta', () => {
    const o = ofertasParaTela(db, HOJE).find((x) => x.id === ids[1]);
    expect(o?.valeAPena).toBeNull();
    const tipos = o?.pegadinhas.map((p) => p.tipo);
    expect(tipos).toContain('voo_madrugada');
    expect(tipos).toContain('escala_longa');
    expect(tipos).toContain('sem_mala_despachada');
  });

  it('esconde as descartadas', () => {
    descartarOferta(db, ids[0] as number);
    expect(ofertasParaTela(db, HOJE).map((o) => o.id)).not.toContain(ids[0]);
  });
});

describe('linkSeguro', () => {
  it('aceita so https', () => {
    expect(linkSeguro('https://www.kiwi.com/u/x')).toBe('https://www.kiwi.com/u/x');
    expect(linkSeguro('javascript:alert(1)')).toBeNull();
    expect(linkSeguro('http://exemplo.com')).toBeNull();
    expect(linkSeguro('não é link')).toBeNull();
    expect(linkSeguro(null)).toBeNull();
  });
});
