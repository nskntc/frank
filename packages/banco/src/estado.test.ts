import { beforeEach, describe, expect, it } from 'vitest';
import { abrirBanco, type Banco } from './abrir.js';
import { apagarEstado, CHAVES_ESTADO, gravarEstado, lerEstado, listarEstado } from './estado.js';

let db: Banco;
beforeEach(() => {
  db = abrirBanco(':memory:');
});

describe('estado do vigia', () => {
  it('grava, sobrescreve e apaga', () => {
    gravarEstado(db, CHAVES_ESTADO.vigiaVistoEm, 'a', new Date('2027-01-01T00:00:00Z'));
    gravarEstado(db, CHAVES_ESTADO.vigiaVistoEm, 'b', new Date('2027-01-02T00:00:00Z'));
    expect(lerEstado(db, CHAVES_ESTADO.vigiaVistoEm)).toEqual({ valor: 'b', atualizadoEm: '2027-01-02T00:00:00.000Z' });
    apagarEstado(db, CHAVES_ESTADO.vigiaVistoEm);
    expect(lerEstado(db, CHAVES_ESTADO.vigiaVistoEm)).toBeNull();
  });

  it('lista por prefixo, sem tratar _ como curinga', () => {
    const t = new Date('2027-01-01T00:00:00Z');
    gravarEstado(db, CHAVES_ESTADO.teto('kiwi'), '300', t);
    gravarEstado(db, CHAVES_ESTADO.teto('serpapi'), '240', t);
    gravarEstado(db, CHAVES_ESTADO.erroAviso('email'), 'falhou', t);
    gravarEstado(db, 'tetoXfalso', 'x', t);
    expect(listarEstado(db, 'teto:').map((e) => e.chave)).toEqual(['teto:kiwi', 'teto:serpapi']);
    expect(listarEstado(db, 'erro_aviso:')).toEqual([
      { chave: 'erro_aviso:email', valor: 'falhou', atualizadoEm: '2027-01-01T00:00:00.000Z' },
    ]);
    expect(listarEstado(db, 'erro%')).toEqual([]);
  });
});
