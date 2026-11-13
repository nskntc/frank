import { beforeEach, describe, expect, it } from 'vitest';
import { abrirBanco, type Banco } from './abrir.js';
import { instante, vigilanciaExemplo } from './teste/dados.js';
import {
  apagarVigilancia,
  atualizarVigilancia,
  criarVigilancia,
  definirAtiva,
  gravarRodizio,
  listarVigilancias,
  marcarRodada,
  obterRodizio,
  obterVigilancia,
  vigilanciasDevidas,
} from './vigilancias.js';

let db: Banco;
beforeEach(() => {
  db = abrirBanco(':memory:');
});

describe('vigilancias', () => {
  it('grava e le de volta todos os campos', () => {
    const criada = criarVigilancia(db, vigilanciaExemplo, instante('2026-11-11T12:00:00.000Z'));
    expect(criada.ativa).toBe(true);
    expect(obterVigilancia(db, criada.id)).toEqual({
      ...vigilanciaExemplo,
      id: criada.id,
      ativa: true,
      criadaEm: '2026-11-11T12:00:00.000Z',
      atualizadaEm: '2026-11-11T12:00:00.000Z',
      historicoDesde: '2026-11-11T12:00:00.000Z',
      ultimaRodadaEm: null,
      ultimaRodadaResultado: null,
    });
  });

  it('guarda o resultado da ultima rodada', () => {
    const v = criarVigilancia(db, vigilanciaExemplo);
    const resultado = {
      consultas: 2,
      itinerarios: 0,
      erros: 2,
      puladasPorTeto: 0,
      ultimoErro: 'kiwi: HTTP 503',
    };
    marcarRodada(db, v.id, instante('2026-11-11T12:00:00Z'), resultado);
    expect(obterVigilancia(db, v.id)?.ultimaRodadaResultado).toEqual(resultado);
  });

  it('data de rodada ilegivel conta como vencida, para nunca parar para sempre', () => {
    const v = criarVigilancia(db, vigilanciaExemplo);
    db.prepare(`UPDATE vigilancias SET ultima_rodada_em = 'lixo' WHERE id = ?`).run(v.id);
    expect(vigilanciasDevidas(db, instante('2026-11-11T12:00:00Z')).map((x) => x.id)).toEqual([
      v.id,
    ]);
  });

  it('so fica devida de novo depois do intervalo, mesmo que a rodada tenha falhado', () => {
    const v = criarVigilancia(db, vigilanciaExemplo); // intervalo de 60 min
    expect(vigilanciasDevidas(db, instante('2026-11-11T12:00:00Z')).map((x) => x.id)).toEqual([
      v.id,
    ]);
    marcarRodada(db, v.id, instante('2026-11-11T12:00:00Z'));
    expect(vigilanciasDevidas(db, instante('2026-11-11T12:59:00Z'))).toHaveLength(0);
    expect(vigilanciasDevidas(db, instante('2026-11-11T13:00:00Z')).map((x) => x.id)).toEqual([
      v.id,
    ]);
  });

  it('nao devolve vigilancia pausada e poe a mais atrasada primeiro', () => {
    const a = criarVigilancia(db, vigilanciaExemplo);
    const b = criarVigilancia(db, { ...vigilanciaExemplo, destinos: ['SSA'] });
    const c = criarVigilancia(db, { ...vigilanciaExemplo, destinos: ['FOR'] });
    marcarRodada(db, a.id, instante('2026-11-11T10:00:00Z'));
    marcarRodada(db, b.id, instante('2026-11-11T09:00:00Z'));
    definirAtiva(db, c.id, false);
    expect(vigilanciasDevidas(db, instante('2026-11-11T12:00:00Z')).map((x) => x.id)).toEqual([
      b.id,
      a.id,
    ]);
  });

  it('recusa vigilancia fora do formato', () => {
    expect(() => criarVigilancia(db, { ...vigilanciaExemplo, intervaloMinutos: 5 })).toThrow();
    expect(listarVigilancias(db)).toHaveLength(0);
  });

  it('mudar so o preco-alvo mantem o historico', () => {
    const criada = criarVigilancia(db, vigilanciaExemplo, instante('2026-11-11T12:00:00.000Z'));
    const nova = atualizarVigilancia(
      db,
      criada.id,
      { ...vigilanciaExemplo, precoAlvoCentavos: 70_000 },
      instante('2026-11-12T08:00:00.000Z'),
    );
    expect(nova).toMatchObject({
      precoAlvoCentavos: 70_000,
      criadaEm: '2026-11-11T12:00:00.000Z',
      atualizadaEm: '2026-11-12T08:00:00.000Z',
      historicoDesde: '2026-11-11T12:00:00.000Z',
    });
  });

  it.each([
    ['destino', { destinos: ['SSA'] }],
    [
      'datas',
      { idaDe: '2027-07-10', idaAte: '2027-07-10', voltaDe: '2027-07-17', voltaAte: '2027-07-17' },
    ],
    ['malas', { malasDespachadas: 1 }],
    ['moeda', { moeda: 'USD' }],
  ])('mudar %s recomeca o historico', (_nome, mudanca) => {
    const criada = criarVigilancia(db, vigilanciaExemplo, instante('2026-11-11T12:00:00.000Z'));
    const nova = atualizarVigilancia(
      db,
      criada.id,
      { ...vigilanciaExemplo, ...mudanca },
      instante('2026-11-12T08:00:00.000Z'),
    );
    expect(nova?.historicoDesde).toBe('2026-11-12T08:00:00.000Z');
  });

  it('pausa e lista so as ativas', () => {
    const a = criarVigilancia(db, vigilanciaExemplo);
    criarVigilancia(db, { ...vigilanciaExemplo, destinos: ['SSA'] });
    expect(definirAtiva(db, a.id, false)).toBe(true);
    expect(listarVigilancias(db)).toHaveLength(2);
    expect(listarVigilancias(db, { soAtivas: true }).map((v) => v.destinos)).toEqual([['SSA']]);
  });

  it('responde nulo ou falso para id que nao existe', () => {
    expect(obterVigilancia(db, 'nao-existe')).toBeNull();
    expect(atualizarVigilancia(db, 'nao-existe', vigilanciaExemplo)).toBeNull();
    expect(definirAtiva(db, 'nao-existe', false)).toBe(false);
    expect(apagarVigilancia(db, 'nao-existe')).toBe(false);
  });
});

describe('rodizio de pares', () => {
  it('sem ciclo: null; grava, le e fecha', () => {
    const { id } = criarVigilancia(db, vigilanciaExemplo, instante('2026-11-11T12:00:00.000Z'));
    expect(obterRodizio(db, id)).toBeNull();
    gravarRodizio(db, id, { ciclo: '2026-11-11T13:00:00.000Z', proximoPar: 3 });
    expect(obterRodizio(db, id)).toEqual({ ciclo: '2026-11-11T13:00:00.000Z', proximoPar: 3 });
    gravarRodizio(db, id, null);
    expect(obterRodizio(db, id)).toBeNull();
  });

  it('mudar a viagem recomeca o rodizio; mudar so o preco-alvo nao', () => {
    const { id } = criarVigilancia(db, vigilanciaExemplo, instante('2026-11-11T12:00:00.000Z'));
    gravarRodizio(db, id, { ciclo: 'c1', proximoPar: 2 });
    atualizarVigilancia(db, id, { ...vigilanciaExemplo, precoAlvoCentavos: 50_000 });
    expect(obterRodizio(db, id)).toEqual({ ciclo: 'c1', proximoPar: 2 });
    atualizarVigilancia(db, id, { ...vigilanciaExemplo, destinos: ['SSA'] });
    expect(obterRodizio(db, id)).toBeNull();
  });
});

describe('tentativa extra depois de falha inteira (issue #23)', () => {
  const falha = {
    consultas: 2,
    itinerarios: 0,
    erros: 2,
    puladasPorTeto: 0,
    ultimoErro: 'kiwi: sem conexão',
  };
  const devidas = (iso: string) => vigilanciasDevidas(db, instante(iso)).length;

  it('rodada que falhou inteira volta em 10 min; a repeticao que falha espera o intervalo', () => {
    const v = criarVigilancia(db, vigilanciaExemplo); // 60 min
    marcarRodada(db, v.id, instante('2026-11-11T12:00:00Z'), falha);
    expect(devidas('2026-11-11T12:09:00Z')).toBe(0);
    expect(devidas('2026-11-11T12:10:00Z')).toBe(1);
    marcarRodada(db, v.id, instante('2026-11-11T12:10:00Z'), { ...falha, repeticao: true });
    expect(obterVigilancia(db, v.id)?.ultimaRodadaResultado?.repeticao).toBe(true);
    expect(devidas('2026-11-11T12:20:00Z')).toBe(0);
    expect(devidas('2026-11-11T13:10:00Z')).toBe(1);
  });

  it('falha parcial ou so teto nao antecipa', () => {
    const v = criarVigilancia(db, vigilanciaExemplo);
    marcarRodada(db, v.id, instante('2026-11-11T12:00:00Z'), {
      ...falha,
      itinerarios: 5,
      erros: 1,
    });
    expect(devidas('2026-11-11T12:10:00Z')).toBe(0);
    marcarRodada(db, v.id, instante('2026-11-11T12:00:00Z'), {
      ...falha,
      consultas: 0,
      erros: 0,
      puladasPorTeto: 2,
    });
    expect(devidas('2026-11-11T12:10:00Z')).toBe(0);
  });
});

describe('filtros de horario e duracao (issue #21)', () => {
  const F = {
    duracaoMaximaHoras: 12,
    idaPartidaApos: null,
    idaChegadaAte: '17:00',
    voltaPartidaApos: '14:00',
    voltaChegadaAte: null,
  };

  it('grava e le; filtros todos null somem; JSON estragado vira sem filtros', () => {
    const com = criarVigilancia(db, { ...vigilanciaExemplo, filtros: F });
    expect(obterVigilancia(db, com.id)?.filtros).toEqual(F);
    const vazio = criarVigilancia(db, {
      ...vigilanciaExemplo,
      filtros: { ...F, duracaoMaximaHoras: null, idaChegadaAte: null, voltaPartidaApos: null },
    });
    expect(obterVigilancia(db, vazio.id)).not.toHaveProperty('filtros');
    db.prepare(`UPDATE vigilancias SET filtros = '{"x":' WHERE id = ?`).run(com.id);
    expect(obterVigilancia(db, com.id)).not.toHaveProperty('filtros');
  });

  it('mudar os filtros recomeca o historico de preco', () => {
    const v = criarVigilancia(db, vigilanciaExemplo, instante('2026-11-11T12:00:00.000Z'));
    const depois = atualizarVigilancia(
      db,
      v.id,
      { ...vigilanciaExemplo, filtros: F },
      instante('2026-11-12T12:00:00.000Z'),
    );
    expect(depois?.historicoDesde).toBe('2026-11-12T12:00:00.000Z');
  });
});
