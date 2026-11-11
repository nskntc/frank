import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, isAbsolute, join } from 'node:path';
import { IaIndisponivelError } from './provedor.js';

/**
 * Como o Frank acha e confere o binario `claude`. Portado do `claude_runtime.py` do Harvey.
 *
 * Cada chamada roda isolada: sem ferramentas, sem MCP, sem o CLAUDE.md, hooks, skills, plugins
 * ou settings de quem usa, sem gravar a conversa no historico, numa pasta temporaria vazia, com
 * o pedido pela entrada padrao (nunca na linha de comando). Antes do primeiro pedido, o `--help`
 * precisa listar todas essas opcoes; se faltar uma, o Frank nao chama (sem chamada sem isolamento).
 */

export const OPCOES_OBRIGATORIAS = [
  '--safe-mode',
  '--setting-sources',
  '--no-session-persistence',
  '--disable-slash-commands',
  '--strict-mcp-config',
  '--tools',
  '--output-format',
  '--json-schema',
  '--system-prompt',
] as const;

/** Variaveis herdadas que adicionam instrucoes ou prendem a chamada a outra sessao do Claude Code. */
export const VARIAVEIS_REMOVIDAS = [
  'CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD',
  'CLAUDE_CODE_SIMPLE',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_SSE_PORT',
  'CLAUDE_ENV_FILE',
  'CLAUDE_PROJECT_DIR',
  'CLAUDECODE',
  'OLDPWD',
] as const;

const DICA_INSTALAR =
  'Instale o Claude Code (https://code.claude.com/docs/en/setup) e rode "claude" uma vez para entrar com o seu plano.';

/** No Windows, o npm poe um claude.cmd que chama o claude.exe; o .cmd re-interpreta os argumentos. */
const ALVO_DO_ATALHO = /"(?:%~?dp0%?\\)?((?:[A-Za-z]:\\)?[^"%]*?\bclaude\.exe)"/i;
/** Antes do script de instalacao rodar, o claude.exe do pacote e um texto pequeno, nao o binario. */
const TAMANHO_MINIMO_BINARIO = 4096;

export function alvoDoAtalho(atalho: string, conteudo: string): string {
  const m = ALVO_DO_ATALHO.exec(conteudo);
  const pasta = dirname(atalho);
  if (!m?.[1]) return join(pasta, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
  const alvo = m[1];
  return isAbsolute(alvo) ? alvo : join(pasta, alvo);
}

/**
 * Caminho do executavel `claude` no PATH. No Windows, um atalho .cmd/.bat e trocado pelo
 * claude.exe que ele chama (o cmd.exe re-interpretaria os argumentos vazios, como `--tools ""`).
 */
export function acharClaude(env: NodeJS.ProcessEnv = process.env, plataforma = process.platform): string {
  const nomes = plataforma === 'win32' ? ['claude.exe', 'claude.cmd', 'claude.bat', 'claude'] : ['claude'];
  for (const pasta of (env.PATH ?? env.Path ?? '').split(plataforma === 'win32' ? ';' : delimiter)) {
    if (!pasta) continue;
    for (const nome of nomes) {
      const caminho = join(pasta, nome);
      if (!existsSync(caminho) || !statSync(caminho).isFile()) continue;
      if (plataforma !== 'win32' || !/\.(cmd|bat)$/i.test(caminho)) return caminho;
      const alvo = alvoDoAtalho(caminho, readFileSync(caminho, 'utf8'));
      if (existsSync(alvo) && statSync(alvo).size >= TAMANHO_MINIMO_BINARIO) return alvo;
      throw new IaIndisponivelError(
        'nao_instalado',
        `Achei o atalho ${caminho}, mas o claude.exe que ele chama (${alvo}) não está pronto. ${DICA_INSTALAR}`,
      );
    }
  }
  throw new IaIndisponivelError('nao_instalado', `Não achei o Claude Code no PATH. ${DICA_INSTALAR}`);
}

/** O ambiente da chamada: o de quem usa, menos as fontes de instrucao extra. */
export function ambienteIsolado(pasta: string, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  for (const chave of VARIAVEIS_REMOVIDAS) delete env[chave];
  env.PWD = pasta;
  env.CLAUDE_CODE_SAFE_MODE = '1';
  return env;
}

export interface OpcoesComando {
  modelo?: string;
  /**
   * Arquivo com as instrucoes do Frank (skills), dentro da pasta isolada. Arquivo e nao
   * argumento: no Windows a linha de comando tem limite de tamanho. O `--help` so cita
   * `--system-prompt[-file]`; que o arquivo funciona e provado pelo teste ao vivo.
   */
  arquivoSistema: string;
  /** JSON Schema da resposta (gerado do schema Zod). */
  jsonSchema: string;
}

/** Argumentos de uma chamada isolada, sem ferramentas. O pedido vai pela entrada padrao. */
export function montarArgumentos(opcoes: OpcoesComando): string[] {
  return [
    '-p',
    '--output-format', 'json',
    // Sem ferramenta nenhuma: o pedido pode carregar texto de fora; uma instrucao plantada
    // nele nao tem com o que agir. --strict-mcp-config deixa os MCPs de quem usa de fora.
    '--tools', '',
    '--strict-mcp-config',
    // Nada do CLAUDE.md, hooks, skills, plugins ou settings de quem usa; nada no historico.
    '--safe-mode',
    '--setting-sources', '',
    '--disable-slash-commands',
    '--no-session-persistence',
    '--system-prompt-file', opcoes.arquivoSistema,
    '--json-schema', opcoes.jsonSchema,
    ...(opcoes.modelo ? ['--model', opcoes.modelo] : []),
  ];
}

export function opcoesFaltando(ajuda: string): string[] {
  return OPCOES_OBRIGATORIAS.filter(
    (opcao) => !new RegExp(`(?<![\\w-])${opcao.replace(/[-]/g, '\\-')}(?![\\w-])`).test(ajuda),
  );
}

function apagarPasta(pasta: string): void {
  try {
    rmSync(pasta, { recursive: true, force: true });
  } catch {
    // No Windows a pasta pode ficar presa um instante; nao esconde o resultado da chamada.
  }
}

/** Pasta temporaria vazia, fora do repositorio, apagada no fim. */
export function emPastaIsolada<T>(fn: (pasta: string) => T): T {
  const pasta = mkdtempSync(join(tmpdir(), 'frank-claude-'));
  try {
    return fn(pasta);
  } finally {
    apagarPasta(pasta);
  }
}

/** Igual a `emPastaIsolada`, mas a pasta vive ate a promessa terminar. */
export async function emPastaIsoladaAsync<T>(fn: (pasta: string) => Promise<T>): Promise<T> {
  const pasta = mkdtempSync(join(tmpdir(), 'frank-claude-'));
  try {
    return await fn(pasta);
  } finally {
    apagarPasta(pasta);
  }
}

const conferidos = new Map<string, true>();

function impressaoDigital(executavel: string): string {
  try {
    const s = statSync(executavel);
    return `${executavel}|${s.mtimeMs}|${s.size}`;
  } catch {
    return executavel;
  }
}

/**
 * Confere pelo `--help` se o binario tem todas as opcoes de isolamento. O resultado fica em
 * cache ate o binario mudar. Prova que as opcoes existem; o comportamento e testado ao vivo.
 */
export function conferirIsolamento(executavel: string, prefixo: readonly string[] = []): void {
  const chave = impressaoDigital(executavel) + prefixo.join(' ');
  if (conferidos.has(chave)) return;
  const saida = emPastaIsolada((pasta) =>
    spawnSync(executavel, [...prefixo, '--help'], {
      cwd: pasta,
      env: ambienteIsolado(pasta),
      encoding: 'utf8',
      timeout: 30_000,
      windowsHide: true,
    }),
  );
  if (saida.error || saida.status !== 0) {
    throw new IaIndisponivelError(
      'nao_instalado',
      `Não consegui rodar "${executavel} --help" para conferir o Claude Code. Nenhum pedido foi enviado.`,
      { cause: saida.error },
    );
  }
  const faltando = opcoesFaltando(`${saida.stdout ?? ''}${saida.stderr ?? ''}`);
  if (faltando.length) {
    throw new IaIndisponivelError(
      'isolamento',
      `Este Claude Code não tem ${faltando.join(', ')}, que o Frank usa para isolar as chamadas. ` +
        'Atualize com "claude update". Nenhum pedido foi enviado.',
    );
  }
  conferidos.set(chave, true);
}

export function limparCacheIsolamento(): void {
  conferidos.clear();
}
