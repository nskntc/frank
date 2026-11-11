import { describe, expect, it } from 'vitest';
import { linkDeBusca, montarOndeComprar, type OpcaoParaComprar } from './onde-comprar.js';

const viagem = { origem: 'GRU', destino: 'REC', ida: '2027-03-12', volta: '2027-03-19', adultos: 1 };

describe('linkDeBusca (formatos testados na issue #1)', () => {
  it('Decolar', () => {
    expect(linkDeBusca('Decolar', viagem)).toBe(
      'https://www.decolar.com/shop/flights/results/roundtrip/GRU/REC/2027-03-12/2027-03-19/1/0/0',
    );
  });

  it('LATAM', () => {
    expect(linkDeBusca('LATAM', viagem)).toBe(
      'https://www.latamairlines.com/br/pt/oferta-voos?origin=GRU&destination=REC' +
        '&outbound=2027-03-12T12%3A00%3A00.000Z&inbound=2027-03-19T12%3A00%3A00.000Z' +
        '&adt=1&chd=0&inf=0&trip=RT&cabin=Economy&redemption=false&sort=RECOMMENDED',
    );
  });

  it('Gol, com data DD-MM-AAAA', () => {
    expect(linkDeBusca('GOL', viagem)).toContain('de=GRU&para=REC&ida=12-03-2027&volta=19-03-2027&ADT=1');
  });

  it('Azul, com data MM/DD/AAAA e volta para a origem', () => {
    const link = linkDeBusca('Azul', { ...viagem, adultos: 2 });
    expect(link).toContain('c[0].ds=GRU&c[0].std=03/12/2027&c[0].as=REC');
    expect(link).toContain('c[1].ds=REC&c[1].std=03/19/2027&c[1].as=GRU');
    expect(link).toContain('p[0].c=2');
  });

  it('so ida, vendedor desconhecido ou dado estranho: sem link', () => {
    expect(linkDeBusca('Azul', { ...viagem, volta: null })).toBeNull();
    expect(linkDeBusca('Trip.com', viagem)).toBeNull();
    expect(linkDeBusca('Azul', { ...viagem, origem: 'gru&x=1' })).toBeNull();
    expect(linkDeBusca('Azul', { ...viagem, ida: '12/03/2027' })).toBeNull();
  });
});

/** As opcoes reais do teste ao vivo de 2026-11-11 (issue #18), parte delas. */
const opcoes: OpcaoParaComprar[] = [
  { vendedor: 'Kiwi.com', precoCentavos: 108_300, estrangeiro: true, ehCompanhia: false, link: 'https://www.kiwi.com/u/exemplo' },
  { vendedor: 'Azul', precoCentavos: 108_300, estrangeiro: false, ehCompanhia: true, link: 'https://www.google.com/travel/flights?x' },
  { vendedor: 'Decolar', precoCentavos: 103_600, estrangeiro: false, ehCompanhia: false, link: 'https://www.google.com/travel/flights?x' },
  { vendedor: 'Trip.com', precoCentavos: 104_200, estrangeiro: true, ehCompanhia: false, link: 'https://www.google.com/travel/flights?x' },
];

describe('montarOndeComprar', () => {
  it('ordena pelo preco final (com IOF) e poe as etiquetas', () => {
    const r = montarOndeComprar(opcoes, { viagem, toleranciaPct: 0, vale24h: true });
    expect(r.itens.map((i) => [i.vendedor, i.precoFinalCentavos, i.etiquetas])).toEqual([
      ['Decolar', 103_600, []],
      ['Azul', 108_300, ['24h_para_desistir']],
      ['Trip.com', 107_847, ['empresa_estrangeira']],
      ['Kiwi.com', 112_091, ['empresa_estrangeira']],
    ].sort((a, b) => (a[1] as number) - (b[1] as number)));
    expect(r).toMatchObject({ destacado: 0, motivo: 'mais_barato' });
  });

  it('companhia dentro da tolerancia vira o destaque', () => {
    // Azul R$ 1.083 x Decolar R$ 1.036: 4,5% a mais.
    const r = montarOndeComprar(opcoes, { viagem, toleranciaPct: 5, vale24h: true });
    expect(r.itens[r.destacado]?.vendedor).toBe('Azul');
    expect(r.motivo).toBe('companhia_na_tolerancia');
  });

  it('companhia fora da tolerancia: fica o mais barato', () => {
    const r = montarOndeComprar(opcoes, { viagem, toleranciaPct: 4, vale24h: true });
    expect(r.itens[r.destacado]?.vendedor).toBe('Decolar');
  });

  it('usa o link de busca preenchida quando ha formato; senao o gravado', () => {
    const r = montarOndeComprar(opcoes, { viagem, toleranciaPct: 5, vale24h: true });
    expect(r.itens.find((i) => i.vendedor === 'Decolar')?.link).toContain('decolar.com/shop/flights');
    expect(r.itens.find((i) => i.vendedor === 'Trip.com')?.link).toBe('https://www.google.com/travel/flights?x');
    expect(r.itens.find((i) => i.vendedor === 'Kiwi.com')?.link).toBe('https://www.kiwi.com/u/exemplo');
  });

  it('sem as 24 h (compra em cima da hora): companhia sem a etiqueta', () => {
    const r = montarOndeComprar(opcoes, { viagem, toleranciaPct: 5, vale24h: false });
    expect(r.itens.find((i) => i.vendedor === 'Azul')?.etiquetas).toEqual([]);
  });

  it('lista vazia', () => {
    expect(montarOndeComprar([], { viagem: null, toleranciaPct: 5, vale24h: true })).toEqual({
      itens: [],
      destacado: -1,
      motivo: null,
    });
  });
});
