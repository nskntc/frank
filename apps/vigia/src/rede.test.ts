import {
  abrirBanco,
  CHAVES_ESTADO,
  criarVigilancia,
  lerEstado,
  obterVigilancia,
} from '@frank/banco';
import { describe, expect, it } from 'vitest';
import { conferidorDeRede } from './rede.js';
import { FonteFalsa, itinerario, logEmMemoria, vigilanciaExemplo } from './teste/apoio.js';
import { Vigia } from './vigia.js';

const erro = (code: string) => Object.assign(new Error(code), { code });

describe('conferidorDeRede', () => {
  it('endereco resolvido: tem rede; ENOTFOUND ou demora: sem rede; outro erro: deixa a rodada dizer', async () => {
    expect(await conferidorDeRede('x', 1000, async () => ({}))()).toBe(true);
    expect(await conferidorDeRede('x', 1000, async () => Promise.reject(erro('ENOTFOUND')))()).toBe(
      false,
    );
    expect(await conferidorDeRede('x', 10, () => new Promise(() => {}))()).toBe(false);
    expect(await conferidorDeRede('x', 1000, async () => Promise.reject(erro('EPERM')))()).toBe(
      true,
    );
  });
});

describe('vigia sem internet (issue #25)', () => {
  it('nao consulta, nao marca, nao gasta tentativa; grava desde quando; volta sozinho', async () => {
    const db = abrirBanco(':memory:');
    const v = criarVigilancia(db, vigilanciaExemplo);
    let rede = false;
    let agora = new Date('2026-11-16T12:37:00Z');
    const fonte = new FonteFalsa('falsa', async () => [itinerario('x', 1)]);
    const log = logEmMemoria();
    const vigia = new Vigia(
      { db, fontes: [fonte], tetoDiarioPorFonte: 300, log, temRede: async () => rede },
      60_000,
      () => agora,
    );

    expect(await vigia.tique()).toMatchObject({ semRede: true, vigilancias: 0 });
    agora = new Date('2026-11-16T12:38:00Z');
    await vigia.tique();
    expect(fonte.consultas).toHaveLength(0);
    expect(obterVigilancia(db, v.id)?.ultimaRodadaEm).toBeNull();
    expect(db.prepare('SELECT COUNT(*) AS n FROM consultas_fonte').get()).toEqual({ n: 0 });
    expect(lerEstado(db, CHAVES_ESTADO.semRede)?.valor).toBe('2026-11-16T12:37:00.000Z');
    expect(log.linhas.filter((l) => l.includes('sem internet'))).toHaveLength(1);

    rede = true;
    agora = new Date('2026-11-16T12:39:00Z');
    expect((await vigia.tique())?.vigilancias).toBe(1);
    expect(fonte.consultas.length).toBeGreaterThan(0);
    expect(lerEstado(db, CHAVES_ESTADO.semRede)).toBeNull();
    expect(log.linhas.some((l) => l.includes('internet voltou'))).toBe(true);
  });

  it('sem vigilancia devida, nem confere a rede', async () => {
    const db = abrirBanco(':memory:');
    let conferiu = 0;
    const vigia = new Vigia({
      db,
      fontes: [],
      tetoDiarioPorFonte: 300,
      log: logEmMemoria(),
      temRede: async () => {
        conferiu++;
        return false;
      },
    });
    await vigia.tique();
    expect(conferiu).toBe(0);
  });
});
