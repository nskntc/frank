import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { raizDoRepositorio } from '@frank/banco';

/**
 * As skills ficam em `skills/` na raiz do repositorio, achada a partir da pasta onde o processo
 * roda (vigia em apps/vigia, painel em apps/web), como o banco. Nao usa caminho relativo ao
 * arquivo: o Next empacota este codigo e o caminho do arquivo deixa de ser o original.
 * `FRANK_SKILLS` aponta outra pasta, se precisar.
 */
export function pastaSkills(env: NodeJS.ProcessEnv = process.env): string {
  return env.FRANK_SKILLS || join(raizDoRepositorio(), 'skills');
}

export class SkillNaoEncontradaError extends Error {
  constructor(nome: string, caminho: string, options?: { cause?: unknown }) {
    super(`Skill "${nome}" não encontrada em ${caminho}.`, options);
    this.name = 'SkillNaoEncontradaError';
  }
}

/** Le uma skill pelo nome (sem .md). Le do disco a cada chamada: editar a skill vale na hora. */
export function lerSkill(nome: string, pasta: string = pastaSkills()): string {
  if (!/^[a-z_]+$/.test(nome)) throw new SkillNaoEncontradaError(nome, 'nome inválido');
  const caminho = join(pasta, `${nome}.md`);
  try {
    return readFileSync(caminho, 'utf8');
  } catch (erro) {
    throw new SkillNaoEncontradaError(nome, caminho, { cause: erro });
  }
}

/** Junta varias skills num texto de instrucoes do sistema, separadas por regua. */
export function montarSistema(nomes: readonly string[], pasta?: string): string {
  return nomes.map((n) => lerSkill(n, pasta)).join('\n\n---\n\n');
}
