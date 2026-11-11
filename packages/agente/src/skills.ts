import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * As skills ficam em `skills/` na raiz do repositorio. Daqui (packages/agente/src ou /dist),
 * a raiz esta tres pastas acima.
 */
const PASTA_SKILLS = new URL('../../../skills/', import.meta.url);

export class SkillNaoEncontradaError extends Error {
  constructor(nome: string, caminho: string, options?: { cause?: unknown }) {
    super(`Skill "${nome}" não encontrada em ${caminho}.`, options);
    this.name = 'SkillNaoEncontradaError';
  }
}

/** Le uma skill pelo nome (sem .md). Le do disco a cada chamada: editar a skill vale na hora. */
export function lerSkill(nome: string, pasta: URL = PASTA_SKILLS): string {
  if (!/^[a-z_]+$/.test(nome)) throw new SkillNaoEncontradaError(nome, 'nome inválido');
  const caminho = fileURLToPath(new URL(`${nome}.md`, pasta));
  try {
    return readFileSync(caminho, 'utf8');
  } catch (erro) {
    throw new SkillNaoEncontradaError(nome, caminho, { cause: erro });
  }
}

/** Junta varias skills num texto de instrucoes do sistema, separadas por regua. */
export function montarSistema(nomes: readonly string[], pasta?: URL): string {
  return nomes.map((n) => lerSkill(n, pasta)).join('\n\n---\n\n');
}
