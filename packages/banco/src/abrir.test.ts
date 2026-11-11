import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import {
  abrirBanco,
  BancoMaisNovoError,
  caminhoDoBanco,
  emTransacao,
  RaizNaoEncontradaError,
  versaoDoBanco,
} from './abrir.js';
import { MIGRACOES } from './migracoes.js';

const pastas: string[] = [];
afterEach(() => {
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

function pastaTemporaria(): string {
  const p = mkdtempSync(join(tmpdir(), 'frank-banco-'));
  pastas.push(p);
  return p;
}

describe('abrirBanco', () => {
  it('aplica todas as migracoes num banco novo', () => {
    const db = abrirBanco(':memory:');
    expect(versaoDoBanco(db)).toBe(MIGRACOES.length);
    db.close();
  });

  it('cria a pasta e o arquivo, e reabre sem migrar de novo', () => {
    const caminho = join(pastaTemporaria(), 'data', 'frank.db');
    abrirBanco(caminho).close();
    const db = abrirBanco(caminho);
    expect(versaoDoBanco(db)).toBe(MIGRACOES.length);
    db.close();
  });

  it('liga WAL e chaves estrangeiras no arquivo', () => {
    const db = abrirBanco(join(pastaTemporaria(), 'frank.db'));
    expect(db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
    expect(db.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 });
    db.close();
  });

  it('recusa banco de uma versao mais nova do Frank', () => {
    const caminho = join(pastaTemporaria(), 'frank.db');
    const db = abrirBanco(caminho);
    db.exec(`PRAGMA user_version = ${MIGRACOES.length + 1}`);
    db.close();
    expect(() => abrirBanco(caminho)).toThrow(BancoMaisNovoError);
  });
});

describe('migracao de um banco existente', () => {
  it('leva da versao 1 para a atual sem perder vigilancias', () => {
    const caminho = join(pastaTemporaria(), 'frank.db');
    const antigo = new DatabaseSync(caminho);
    antigo.exec(MIGRACOES[0] as string);
    antigo.exec('PRAGMA user_version = 1');
    antigo
      .prepare(
        `INSERT INTO vigilancias VALUES ('v1', 'teste', '["GRU"]', '["REC"]', '2027-03-12', '2027-03-12',
           NULL, NULL, 1, 0, NULL, '[]', 0, NULL, 'BRL', 60, 1, 'x', 'x', 'x')`,
      )
      .run();
    antigo.close();

    const db = abrirBanco(caminho);
    expect(versaoDoBanco(db)).toBe(MIGRACOES.length);
    expect(db.prepare('SELECT id, ultima_rodada_em FROM vigilancias').all()).toEqual([
      { id: 'v1', ultima_rodada_em: null },
    ]);
    db.close();
  });
});

describe('caminhoDoBanco', () => {
  it('acha data/frank.db na raiz do repositorio a partir de uma subpasta', () => {
    const raiz = pastaTemporaria();
    writeFileSync(join(raiz, 'pnpm-workspace.yaml'), '');
    mkdirSync(join(raiz, 'apps', 'vigia'), { recursive: true });
    expect(caminhoDoBanco(join(raiz, 'apps', 'vigia'), {})).toBe(join(raiz, 'data', 'frank.db'));
  });

  it('falha em vez de criar outro banco quando nao acha a raiz', () => {
    expect(() => caminhoDoBanco(pastaTemporaria(), {})).toThrow(RaizNaoEncontradaError);
  });

  it('FRANK_BANCO tem prioridade', () => {
    const outro = join(pastaTemporaria(), 'outro.db');
    expect(caminhoDoBanco('.', { FRANK_BANCO: outro })).toBe(outro);
  });
});

describe('dois processos abrindo o mesmo arquivo', () => {
  it('o segundo abre sem migrar de novo, mesmo com o primeiro aberto', () => {
    const caminho = join(pastaTemporaria(), 'frank.db');
    const vigia = abrirBanco(caminho);
    const painel = abrirBanco(caminho);
    expect(versaoDoBanco(painel)).toBe(MIGRACOES.length);
    painel.close();
    vigia.close();
  });
});

describe('emTransacao', () => {
  it('aninha com savepoint: desfaz so a parte de dentro', () => {
    const db = abrirBanco(':memory:');
    db.exec('CREATE TABLE t (a INTEGER NOT NULL)');
    emTransacao(db, () => {
      db.prepare('INSERT INTO t VALUES (1)').run();
      expect(() =>
        emTransacao(db, () => {
          db.prepare('INSERT INTO t VALUES (2)').run();
          throw new Error('falha de dentro');
        }),
      ).toThrow('falha de dentro');
    });
    expect(db.prepare('SELECT a FROM t').all()).toEqual([{ a: 1 }]);
    db.close();
  });

  it('desfaz tudo se algo falhar no meio', () => {
    const db = abrirBanco(':memory:');
    db.exec('CREATE TABLE t (a INTEGER NOT NULL)');
    expect(() =>
      emTransacao(db, () => {
        db.prepare('INSERT INTO t VALUES (1)').run();
        db.prepare('INSERT INTO t VALUES (NULL)').run();
      }),
    ).toThrow();
    expect(db.prepare('SELECT COUNT(*) AS n FROM t').get()).toEqual({ n: 0 });
    db.close();
  });
});
