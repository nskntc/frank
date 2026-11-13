import type { Vigilancia } from '@frank/contratos';
import { describe, expect, it } from 'vitest';
import { situacaoDaRota, sugestoesSemVoos } from './situacao';

const V: Vigilancia = {
  id: 'v1',
  descricao: 'Curitiba para Aruba em março',
  origens: ['CWB'],
  destinos: ['AUA'],
  idaDe: '2027-03-10',
  idaAte: '2027-03-10',
  voltaDe: '2027-03-17',
  voltaAte: '2027-03-17',
  adultos: 1,
  malasDespachadas: 0,
  maxEscalas: null,
  companhias: [],
  aceitarPassagensSeparadas: false,
  precoAlvoCentavos: null,
  moeda: 'BRL',
  intervaloMinutos: 60,
  ativa: true,
  criadaEm: '2026-11-13T10:00:00.000Z',
  atualizadaEm: '2026-11-13T10:00:00.000Z',
  historicoDesde: '2026-11-13T10:00:00.000Z',
  ultimaRodadaEm: '2026-11-13T10:01:00.000Z',
  ultimaRodadaResultado: {
    consultas: 1,
    itinerarios: 0,
    erros: 0,
    puladasPorTeto: 0,
    ultimoErro: null,
  },
};

describe('situacaoDaRota', () => {
  it('distingue nunca rodou, falhou, nao achou voo e ok', () => {
    expect(
      situacaoDaRota({ ...V, ultimaRodadaEm: null, ultimaRodadaResultado: null }, false).tipo,
    ).toBe('nunca_rodou');
    expect(
      situacaoDaRota(
        {
          ...V,
          ultimaRodadaResultado: {
            consultas: 1,
            itinerarios: 0,
            erros: 1,
            puladasPorTeto: 0,
            ultimoErro: 'kiwi: HTTP 503',
          },
        },
        false,
      ),
    ).toMatchObject({ tipo: 'falhou', erro: 'kiwi: HTTP 503', tentaLogo: true });
    expect(situacaoDaRota(V, false)).toMatchObject({ tipo: 'sem_voos', nuncaAchou: true });
    expect(
      situacaoDaRota(
        {
          ...V,
          ultimaRodadaResultado: {
            consultas: 1,
            itinerarios: 15,
            erros: 0,
            puladasPorTeto: 0,
            ultimoErro: null,
          },
        },
        true,
      ),
    ).toMatchObject({ tipo: 'ok', voos: 15 });
    expect(situacaoDaRota({ ...V, ativa: false }, false).tipo).toBe('pausada');
  });

  it('ja achou voo antes: a checagem vazia nao vira "nunca achou"', () => {
    expect(situacaoDaRota(V, true)).toMatchObject({ tipo: 'sem_voos', nuncaAchou: false });
  });

  it('teto sem consulta nenhuma e falha, nao "sem voos"', () => {
    const r = {
      consultas: 0,
      itinerarios: 0,
      erros: 0,
      puladasPorTeto: 1,
      ultimoErro: 'kiwi: teto',
    };
    expect(situacaoDaRota({ ...V, ultimaRodadaResultado: r }, false).tipo).toBe('falhou');
  });
});

describe('sugestoesSemVoos', () => {
  it('passagem unica, aeroporto regional e datas fixas: sugere as tres, nessa ordem', () => {
    expect(sugestoesSemVoos(V).map((s) => s.noPedido)).toEqual([
      'pode ser com passagens separadas',
      'saindo também de GRU ou POA',
      'com datas flexíveis, dois dias antes ou depois',
    ]);
  });

  it('nao sugere o que ja esta liberado nem o hub que ja e origem', () => {
    const aberta = {
      ...V,
      origens: ['GRU'],
      aceitarPassagensSeparadas: true,
      idaAte: '2027-03-14',
      voltaAte: '2027-03-21',
    };
    expect(sugestoesSemVoos(aberta)).toEqual([]);
    expect(sugestoesSemVoos({ ...V, origens: ['GYN', 'BSB'] }).map((s) => s.noPedido)).toContain(
      'saindo também de GRU',
    );
  });

  it('escalas e companhias restritas viram sugestao', () => {
    const restrita = { ...V, maxEscalas: 1, companhias: ['LA'] };
    expect(sugestoesSemVoos(restrita).map((s) => s.noPedido)).toEqual(
      expect.arrayContaining(['com qualquer número de escalas', 'qualquer companhia']),
    );
  });
});
