import { beforeEach, describe, expect, it } from 'vitest';
import { abrirBanco, type Banco } from './abrir.js';
import {
  jaViuVoo,
  listarReferencias,
  menoresPorRodada,
  obterPrecoVisto,
  precosDaRodada,
  registrarPrecosVistos,
  salvarReferencias,
  maisBaratoPorDia,
  serieDaVigilancia,
  ultimaRodada,
} from './precos.js';
import { instante, itinerarioExemplo, vigilanciaExemplo } from './teste/dados.js';
import { apagarVigilancia, atualizarVigilancia, criarVigilancia } from './vigilancias.js';

const criacao = instante('2026-11-01T00:00:00.000Z');
const desdeSempre = instante('2000-01-01T00:00:00.000Z');

let db: Banco;
let vigilanciaId: string;
beforeEach(() => {
  db = abrirBanco(':memory:');
  vigilanciaId = criarVigilancia(db, vigilanciaExemplo, criacao).id;
});

describe('precos vistos', () => {
  it('grava a busca e le o itinerario inteiro de volta', () => {
    const [id] = registrarPrecosVistos(db, vigilanciaId, 'r1', [itinerarioExemplo('a', 109_200)]);
    const visto = obterPrecoVisto(db, id as number);
    expect(visto).toMatchObject({ rodada: 'r1', precoCentavos: 109_200 });
    expect(visto?.itinerario).toEqual(itinerarioExemplo('a', 109_200));
  });

  it('nao grava nada se um itinerario da busca for invalido', () => {
    const invalido = { ...itinerarioExemplo('b', 1), precoCentavos: 10.5 };
    expect(() =>
      registrarPrecosVistos(db, vigilanciaId, 'r1', [itinerarioExemplo('a', 100_000), invalido]),
    ).toThrow();
    expect(ultimaRodada(db, vigilanciaId)).toHaveLength(0);
  });

  it('linha antiga fora do contrato atual vira itinerario nulo, sem derrubar a leitura', () => {
    const [id] = registrarPrecosVistos(db, vigilanciaId, 'r1', [itinerarioExemplo('a', 100_000)]);
    db.prepare(`UPDATE precos_vistos SET itinerario = '{"formato":"antigo"}' WHERE id = ?`).run(
      id as number,
    );
    expect(obterPrecoVisto(db, id as number)).toMatchObject({
      precoCentavos: 100_000,
      itinerario: null,
    });
  });

  it('apagar a vigilancia apaga os precos dela', () => {
    registrarPrecosVistos(db, vigilanciaId, 'r1', [itinerarioExemplo('a', 100_000)]);
    apagarVigilancia(db, vigilanciaId);
    expect(db.prepare('SELECT COUNT(*) AS n FROM precos_vistos').get()).toEqual({ n: 0 });
  });
});

describe('menoresPorRodada (base do preco normal)', () => {
  it('conta uma observacao por rodada, com o menor preco dela', () => {
    const t1 = instante('2026-11-02T10:00:00Z');
    // Rodada 1 em duas buscas (por companhia), mesmo ciclo.
    registrarPrecosVistos(
      db,
      vigilanciaId,
      'r1',
      [itinerarioExemplo('a', 120_000), itinerarioExemplo('b', 99_000)],
      t1,
    );
    registrarPrecosVistos(db, vigilanciaId, 'r1', [itinerarioExemplo('c', 150_000)], t1);
    registrarPrecosVistos(
      db,
      vigilanciaId,
      'r2',
      [itinerarioExemplo('a', 110_000)],
      instante('2026-11-02T11:00:00Z'),
    );
    expect(menoresPorRodada(db, vigilanciaId, desdeSempre, 'BRL')).toEqual([99_000, 110_000]);
  });

  it('respeita o instante pedido e a moeda', () => {
    registrarPrecosVistos(
      db,
      vigilanciaId,
      'r1',
      [itinerarioExemplo('a', 100_000)],
      instante('2026-11-02T00:00:00Z'),
    );
    registrarPrecosVistos(
      db,
      vigilanciaId,
      'r2',
      [itinerarioExemplo('a', 110_000)],
      instante('2026-11-10T00:00:00Z'),
    );
    registrarPrecosVistos(
      db,
      vigilanciaId,
      'r2',
      [{ ...itinerarioExemplo('b', 50_000), moeda: 'EUR' }],
      instante('2026-11-10T00:00:00Z'),
    );
    expect(menoresPorRodada(db, vigilanciaId, instante('2026-11-05T00:00:00Z'), 'BRL')).toEqual([
      110_000,
    ]);
  });

  it('deixa de fora a rodada que esta sendo avaliada', () => {
    registrarPrecosVistos(
      db,
      vigilanciaId,
      'r1',
      [itinerarioExemplo('a', 100_000)],
      instante('2026-11-02T00:00:00Z'),
    );
    registrarPrecosVistos(
      db,
      vigilanciaId,
      'r2',
      [itinerarioExemplo('a', 60_000)],
      instante('2026-11-03T00:00:00Z'),
    );
    expect(menoresPorRodada(db, vigilanciaId, desdeSempre, 'BRL', 'r2')).toEqual([100_000]);
    expect(precosDaRodada(db, vigilanciaId, 'r2').map((p) => p.precoCentavos)).toEqual([60_000]);
  });

  it('ignora o historico de antes de mudar a viagem', () => {
    registrarPrecosVistos(
      db,
      vigilanciaId,
      'r1',
      [itinerarioExemplo('a', 100_000)],
      instante('2026-11-02T00:00:00Z'),
    );
    atualizarVigilancia(
      db,
      vigilanciaId,
      { ...vigilanciaExemplo, destinos: ['SSA'] },
      instante('2026-11-05T00:00:00Z'),
    );
    registrarPrecosVistos(
      db,
      vigilanciaId,
      'r2',
      [itinerarioExemplo('b', 80_000)],
      instante('2026-11-06T00:00:00Z'),
    );
    expect(menoresPorRodada(db, vigilanciaId, desdeSempre, 'BRL')).toEqual([80_000]);
  });
});

describe('ultimaRodada', () => {
  it('traz todas as buscas da rodada mais recente, do mais barato ao mais caro', () => {
    registrarPrecosVistos(
      db,
      vigilanciaId,
      'r1',
      [itinerarioExemplo('a', 100_000)],
      instante('2026-11-10T00:00:00Z'),
    );
    registrarPrecosVistos(
      db,
      vigilanciaId,
      'r2',
      [itinerarioExemplo('c', 130_000)],
      instante('2026-11-11T00:00:00Z'),
    );
    registrarPrecosVistos(
      db,
      vigilanciaId,
      'r2',
      [itinerarioExemplo('b', 90_000)],
      instante('2026-11-11T00:00:05Z'),
    );
    expect(ultimaRodada(db, vigilanciaId).map((p) => p.idNaFonte)).toEqual(['b', 'c']);
  });
});

describe('referencias de preco', () => {
  it('grava o historico externo e regrava o mesmo dia sem duplicar', () => {
    salvarReferencias(db, vigilanciaId, 'google', 'BRL', [
      { dia: '2026-09-12', precoCentavos: 90_100 },
      { dia: '2026-09-13', precoCentavos: 94_500 },
    ]);
    salvarReferencias(db, vigilanciaId, 'google', 'BRL', [
      { dia: '2026-09-13', precoCentavos: 71_800 },
    ]);
    expect(listarReferencias(db, vigilanciaId, 'BRL')).toEqual([
      { fonte: 'google', dia: '2026-09-12', precoCentavos: 90_100 },
      { fonte: 'google', dia: '2026-09-13', precoCentavos: 71_800 },
    ]);
  });
});

describe('serieDaVigilancia (grafico da rota)', () => {
  it('um ponto por rodada, com o menor preco e o inicio da rodada, so da viagem atual e da moeda', () => {
    registrarPrecosVistos(
      db,
      vigilanciaId,
      'r0',
      [itinerarioExemplo('a', 90_000)],
      instante('2026-11-02T00:00:00Z'),
    );
    atualizarVigilancia(
      db,
      vigilanciaId,
      { ...vigilanciaExemplo, destinos: ['SSA'] },
      instante('2026-11-05T00:00:00Z'),
    );
    registrarPrecosVistos(
      db,
      vigilanciaId,
      'r1',
      [itinerarioExemplo('a', 120_000)],
      instante('2026-11-06T10:00:00Z'),
    );
    registrarPrecosVistos(
      db,
      vigilanciaId,
      'r1',
      [itinerarioExemplo('b', 99_000)],
      instante('2026-11-06T10:01:00Z'),
    );
    registrarPrecosVistos(
      db,
      vigilanciaId,
      'r2',
      [{ ...itinerarioExemplo('c', 10_000), moeda: 'EUR' }, itinerarioExemplo('d', 105_000)],
      instante('2026-11-06T11:00:00Z'),
    );
    expect(serieDaVigilancia(db, vigilanciaId, 'BRL')).toEqual([
      { rodada: 'r1', em: '2026-11-06T10:00:00.000Z', precoCentavos: 99_000 },
      { rodada: 'r2', em: '2026-11-06T11:00:00.000Z', precoCentavos: 105_000 },
    ]);
  });
});

describe('maisBaratoPorDia (botao de compra da tabela)', () => {
  it('o mais barato de cada dia de Brasilia, o mais novo primeiro; empate fica com o mais recente', () => {
    const r = (rodada: string, id: string, preco: number, quando: string) =>
      registrarPrecosVistos(
        db,
        vigilanciaId,
        rodada,
        [itinerarioExemplo(id, preco)],
        instante(quando),
      );
    // 01:00 UTC do dia 3 ainda e dia 2 em Brasilia.
    r('r1', 'a', 90_000, '2026-11-02T15:00:00Z');
    r('r2', 'b', 85_000, '2026-11-03T01:00:00Z');
    r('r3', 'c', 95_000, '2026-11-03T12:00:00Z');
    r('r4', 'd', 95_000, '2026-11-03T18:00:00Z');
    registrarPrecosVistos(
      db,
      vigilanciaId,
      'r5',
      [{ ...itinerarioExemplo('e', 1_000), moeda: 'EUR' }],
      instante('2026-11-03T19:00:00Z'),
    );
    expect(
      maisBaratoPorDia(db, vigilanciaId, 'BRL').map((p) => [p.dia, p.idNaFonte, p.precoCentavos]),
    ).toEqual([
      ['2026-11-03', 'd', 95_000],
      ['2026-11-02', 'b', 85_000],
    ]);
    expect(maisBaratoPorDia(db, vigilanciaId, 'BRL')[0]?.itinerario?.linkCompra).toBe(
      'https://www.kiwi.com/u/d',
    );
  });
});

describe('jaViuVoo', () => {
  it('nenhum preco: false; com preco: true; mudar a viagem zera', () => {
    expect(jaViuVoo(db, vigilanciaId)).toBe(false);
    registrarPrecosVistos(
      db,
      vigilanciaId,
      'r1',
      [itinerarioExemplo('a', 100_000)],
      instante('2026-11-02T00:00:00.000Z'),
    );
    expect(jaViuVoo(db, vigilanciaId)).toBe(true);
    atualizarVigilancia(
      db,
      vigilanciaId,
      { ...vigilanciaExemplo, destinos: ['SSA'] },
      instante('2026-11-03T00:00:00.000Z'),
    );
    expect(jaViuVoo(db, vigilanciaId)).toBe(false);
  });
});
