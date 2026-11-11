import { abrirBanco, type Banco, criarVigilancia, obterVigilancia, ultimaRodada } from '@frank/banco';
import { beforeEach, describe, expect, it } from 'vitest';
import { companhiasDoResultado, consultasDaVigilancia, proximaExclusao } from './consultas.js';
import { executarRodada } from './rodada.js';
import { fonteComEstoque, itinerario, logEmMemoria, vigilanciaExemplo } from './teste/apoio.js';

const agora = new Date('2026-11-11T12:00:00.000Z');
const soGru = { ...vigilanciaExemplo, origens: ['GRU'] };
let db: Banco;

beforeEach(() => {
  db = abrirBanco(':memory:');
});

function companhiasGravadas(vigilanciaId: string): string[] {
  return companhiasDoResultado(
    ultimaRodada(db, vigilanciaId).flatMap((p) => (p.itinerario ? [p.itinerario] : [])),
  );
}

describe('divisao da busca por companhia (RF-05)', () => {
  it('Kiwi cheia de Azul: busca de novo sem a Azul e acha LATAM e Gol', async () => {
    const v = criarVigilancia(db, soGru);
    const fonte = fonteComEstoque({ AD: 20, LA: 5, G3: 3 });
    const resumo = await executarRodada({ db, fontes: [fonte], tetoDiarioPorFonte: 300, log: logEmMemoria() }, agora);

    expect(fonte.consultas.map((c) => c.excluirCompanhias ?? [])).toEqual([[], ['AD']]);
    expect(companhiasGravadas(v.id)).toEqual(['AD', 'G3', 'LA']);
    expect(resumo).toMatchObject({ consultas: 2, itinerarios: 23 });
  });

  it('para no maximo de buscas por par', async () => {
    criarVigilancia(db, soGru);
    const fonte = fonteComEstoque({ AD: 15, LA: 15, G3: 15, JJ: 15 });
    await executarRodada({ db, fontes: [fonte], tetoDiarioPorFonte: 300, maxBuscasPorPar: 3, log: logEmMemoria() }, agora);
    expect(fonte.consultas.map((c) => c.excluirCompanhias ?? [])).toEqual([[], ['AD'], ['AD', 'LA']]);
  });

  it('resposta que nao veio cheia: uma busca so', async () => {
    criarVigilancia(db, soGru);
    const fonte = fonteComEstoque({ AD: 4, LA: 2 });
    await executarRodada({ db, fontes: [fonte], tetoDiarioPorFonte: 300, log: logEmMemoria() }, agora);
    expect(fonte.consultas).toHaveLength(1);
  });

  it('companhias escolhidas pela pessoa: uma busca so, sem exclusao', async () => {
    criarVigilancia(db, { ...soGru, companhias: ['LA'] });
    const fonte = fonteComEstoque({ AD: 5, LA: 20 });
    await executarRodada({ db, fontes: [fonte], tetoDiarioPorFonte: 300, log: logEmMemoria() }, agora);
    expect(fonte.consultas.map((c) => [c.companhias, c.excluirCompanhias])).toEqual([[['LA'], undefined]]);
  });

  it('o teto vale para cada busca extra', async () => {
    const v = criarVigilancia(db, soGru);
    const fonte = fonteComEstoque({ AD: 20, LA: 5 });
    await executarRodada({ db, fontes: [fonte], tetoDiarioPorFonte: 1, log: logEmMemoria() }, agora);
    expect(fonte.consultas).toHaveLength(1);
    expect(obterVigilancia(db, v.id)?.ultimaRodadaResultado?.puladasPorTeto).toBe(1);
  });
});

describe('proximaExclusao', () => {
  const cheia = Array.from({ length: 15 }, (_, i) => itinerario(`a${i}`, 1, 'GRU', 'AD'));

  it('sem limite conhecido da fonte, nao divide', () => {
    expect(proximaExclusao(cheia, undefined, [])).toBeNull();
  });

  it('resposta cheia so com companhias ja excluidas: para', () => {
    expect(proximaExclusao(cheia, 15, ['AD'])).toBeNull();
  });

  it('soma as companhias novas as ja excluidas', () => {
    expect(proximaExclusao(cheia, 15, ['LA'])).toEqual(['LA', 'AD']);
  });
});

describe('consultasDaVigilancia: janela de datas', () => {
  it('manda a janela inteira numa busca so', () => {
    const [c] = consultasDaVigilancia({
      ...vigilanciaExemplo,
      idaDe: '2027-03-10',
      idaAte: '2027-03-14',
      voltaDe: '2027-03-17',
      voltaAte: '2027-03-21',
      id: 'v',
      ativa: true,
      criadaEm: '',
      atualizadaEm: '',
      historicoDesde: '',
      ultimaRodadaEm: null,
      ultimaRodadaResultado: null,
    });
    expect(c).toMatchObject({ ida: '2027-03-10', idaAte: '2027-03-14', volta: '2027-03-17', voltaAte: '2027-03-21' });
  });
});
