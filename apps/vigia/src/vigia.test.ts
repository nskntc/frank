import { abrirBanco, CHAVES_ESTADO, criarVigilancia, lerEstado } from '@frank/banco';
import { describe, expect, it } from 'vitest';
import { lerConfig } from './config.js';
import { consultasDaVigilancia } from './consultas.js';
import { FonteFalsa, itinerario, logEmMemoria, vigilanciaExemplo } from './teste/apoio.js';
import { Vigia } from './vigia.js';

describe('Vigia', () => {
  it('nunca roda duas rodadas ao mesmo tempo', async () => {
    const db = abrirBanco(':memory:');
    criarVigilancia(db, vigilanciaExemplo);
    let liberar: () => void = () => {};
    const fonte = new FonteFalsa(
      'lenta',
      () => new Promise((ok) => (liberar = () => ok([itinerario('x', 1)]))),
    );
    const vigia = new Vigia({ db, fontes: [fonte], tetoDiarioPorFonte: 300, log: logEmMemoria() });

    const primeira = vigia.tique();
    expect(await vigia.tique()).toBeNull();
    liberar();
    await new Promise((r) => setTimeout(r, 0));
    liberar();
    expect((await primeira)?.vigilancias).toBe(1);
  });

  it('retoma sozinho: o tique seguinte roda o que venceu enquanto estava parado', async () => {
    const db = abrirBanco(':memory:');
    criarVigilancia(db, vigilanciaExemplo);
    let agora = new Date('2026-11-11T12:00:00Z');
    const fonte = new FonteFalsa('falsa', async () => [itinerario('x', 1)]);
    const vigia = new Vigia({ db, fontes: [fonte], tetoDiarioPorFonte: 300, log: logEmMemoria() }, 60_000, () => agora);

    expect((await vigia.tique())?.vigilancias).toBe(1);
    agora = new Date('2026-11-11T12:30:00Z');
    expect((await vigia.tique())?.vigilancias).toBe(0);
    agora = new Date('2026-11-11T18:00:00Z'); // "acordou" 6 h depois
    expect((await vigia.tique())?.vigilancias).toBe(1);
  });

  it('grava o sinal de vida a cada tique, mesmo sem nada para fazer', async () => {
    const db = abrirBanco(':memory:');
    const agora = new Date('2026-11-11T12:00:00Z');
    const vigia = new Vigia({ db, fontes: [], tetoDiarioPorFonte: 300, log: logEmMemoria() }, 60_000, () => agora);
    await vigia.tique();
    expect(lerEstado(db, CHAVES_ESTADO.vigiaVistoEm)?.valor).toBe('2026-11-11T12:00:00.000Z');
  });

  it('erro que derruba o ciclo inteiro fica gravado para o painel e some quando resolve', async () => {
    const db = abrirBanco(':memory:');
    const log = logEmMemoria();
    const vigia = new Vigia({ db, fontes: [], tetoDiarioPorFonte: 300, log });
    db.exec('ALTER TABLE vigilancias RENAME TO quebrada');
    expect(await vigia.tique()).toBeNull();
    expect(lerEstado(db, CHAVES_ESTADO.ultimoErroCiclo)?.valor).toContain('vigilancias');
    expect(log.linhas.some((l) => l.startsWith('erro rodada falhou'))).toBe(true);

    db.exec('ALTER TABLE quebrada RENAME TO vigilancias');
    expect(await vigia.tique()).not.toBeNull();
    expect(lerEstado(db, CHAVES_ESTADO.ultimoErroCiclo)).toBeNull();
  });

  it('para e espera a rodada em andamento', async () => {
    const db = abrirBanco(':memory:');
    const vigia = new Vigia({ db, fontes: [], tetoDiarioPorFonte: 300, log: logEmMemoria() }, 10);
    vigia.iniciar();
    await vigia.parar();
    expect(await vigia.tique()).not.toBeNull();
  });
});

describe('consultasDaVigilancia', () => {
  it('leva filtros da vigilancia para a busca e omite volta em so ida', () => {
    const [primeira] = consultasDaVigilancia({
      ...vigilanciaExemplo,
      voltaDe: null,
      voltaAte: null,
      maxEscalas: 0,
      companhias: ['LA'],
      id: 'v',
      ativa: true,
      criadaEm: '',
      atualizadaEm: '',
      historicoDesde: '',
      ultimaRodadaEm: null,
      ultimaRodadaResultado: null,
    });
    expect(primeira).toEqual({
      origem: 'GRU',
      destino: 'REC',
      ida: '2027-03-12',
      adultos: 1,
      malasDespachadas: 0,
      maxEscalas: 0,
      companhias: ['LA'],
      aceitarPassagensSeparadas: false,
      moeda: 'BRL',
    });
  });
});

describe('lerConfig', () => {
  it('usa os padroes e aceita sobrescrever', () => {
    expect(lerConfig({})).toEqual({ tetoDiarioPorFonte: 300, tiqueMs: 60_000 });
    expect(lerConfig({ FRANK_TETO_DIARIO_FONTE: '50' }).tetoDiarioPorFonte).toBe(50);
  });

  it('recusa valor invalido em vez de usar um padrao escondido', () => {
    expect(() => lerConfig({ FRANK_TETO_DIARIO_FONTE: 'muito' })).toThrow(RangeError);
  });
});
