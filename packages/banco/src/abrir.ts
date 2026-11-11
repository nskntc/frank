import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MIGRACOES } from './migracoes.js';

export type Banco = DatabaseSync;

/**
 * O banco que o vigia e o painel dividem: `FRANK_BANCO` se definido; senao `data/frank.db` na
 * raiz do repositorio (a pasta com `pnpm-workspace.yaml`), procurada a partir de `de`. O vigia e o
 * painel rodam em pastas diferentes (apps/vigia, apps/web) e precisam abrir o mesmo arquivo.
 */
export function caminhoDoBanco(de: string = process.cwd(), env = process.env): string {
  if (env.FRANK_BANCO) return resolve(env.FRANK_BANCO);
  let pasta = resolve(de);
  for (;;) {
    if (existsSync(join(pasta, 'pnpm-workspace.yaml'))) return join(pasta, 'data', 'frank.db');
    const acima = dirname(pasta);
    // Sem raiz achada, falha em vez de criar outro banco calado: o vigia e o painel
    // acabariam em arquivos diferentes e o painel mostraria tudo vazio.
    if (acima === pasta) throw new RaizNaoEncontradaError(de);
    pasta = acima;
  }
}

export class RaizNaoEncontradaError extends Error {
  constructor(de: string) {
    super(
      `Nao achei a pasta do Frank (com pnpm-workspace.yaml) a partir de "${de}". ` +
        'Rode dentro do repositorio ou defina FRANK_BANCO com o caminho do banco.',
    );
    this.name = 'RaizNaoEncontradaError';
  }
}

/** Caminho padrao relativo, para quem roda na raiz. Prefira `caminhoDoBanco()`. */
export const CAMINHO_PADRAO = 'data/frank.db';

/**
 * Abre (ou cria) o banco e aplica as migracoes pendentes.
 * WAL + busy_timeout: o vigia escreve enquanto o painel le, sem "database is locked".
 * `:memory:` serve para teste.
 */
export function abrirBanco(caminho: string = CAMINHO_PADRAO): Banco {
  if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });
  const db = new DatabaseSync(caminho);
  try {
    // busy_timeout primeiro: vigia e painel podem abrir o banco ao mesmo tempo.
    db.exec('PRAGMA busy_timeout = 5000');
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    migrar(db);
    return db;
  } catch (erro) {
    // Sem isso o arquivo fica preso aberto (no Windows, nem da para apagar a pasta).
    db.close();
    throw erro;
  }
}

export function versaoDoBanco(db: Banco): number {
  const linha = db.prepare('PRAGMA user_version').get() as { user_version: number } | undefined;
  return linha?.user_version ?? 0;
}

export class BancoMaisNovoError extends Error {
  constructor(versao: number) {
    super(
      `O banco esta na versao ${versao}, mais nova que este Frank (${MIGRACOES.length}). Atualize o Frank.`,
    );
    this.name = 'BancoMaisNovoError';
  }
}

/**
 * Cada migracao roda numa transacao IMMEDIATE (pega o lock de escrita na hora) e rele a versao
 * la dentro: se outro processo migrou enquanto este esperava, nada e aplicado duas vezes.
 */
function migrar(db: Banco): void {
  if (versaoDoBanco(db) > MIGRACOES.length) throw new BancoMaisNovoError(versaoDoBanco(db));
  for (let versao = 1; versao <= MIGRACOES.length; versao++) {
    emTransacao(db, () => {
      const atual = versaoDoBanco(db);
      if (atual > MIGRACOES.length) throw new BancoMaisNovoError(atual);
      if (atual >= versao) return;
      db.exec(MIGRACOES[versao - 1] as string);
      db.exec(`PRAGMA user_version = ${versao}`);
    });
  }
}

let contadorSavepoint = 0;

/**
 * Roda `fn` numa transacao: tudo ou nada. Fora de transacao usa BEGIN IMMEDIATE; dentro de
 * outra, um SAVEPOINT (pode aninhar). So desfaz se a transacao ainda estiver aberta, para nao
 * esconder o erro original quando o SQLite ja desfez sozinho.
 */
export function emTransacao<T>(db: Banco, fn: () => T): T {
  if (db.isTransaction) {
    const nome = `sp_${++contadorSavepoint}`;
    db.exec(`SAVEPOINT ${nome}`);
    try {
      const resultado = fn();
      db.exec(`RELEASE ${nome}`);
      return resultado;
    } catch (erro) {
      if (db.isTransaction) {
        db.exec(`ROLLBACK TO ${nome}`);
        db.exec(`RELEASE ${nome}`);
      }
      throw erro;
    }
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const resultado = fn();
    db.exec('COMMIT');
    return resultado;
  } catch (erro) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw erro;
  }
}

/** Numero da linha recem-inserida (o node:sqlite devolve number ou bigint). */
export function idInserido(resultado: { lastInsertRowid: number | bigint }): number {
  return Number(resultado.lastInsertRowid);
}
