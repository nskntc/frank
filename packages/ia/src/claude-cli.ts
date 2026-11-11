import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import {
  acharClaude,
  ambienteIsolado,
  conferirIsolamento,
  emPastaIsoladaAsync,
  montarArgumentos,
} from './binario.js';
import {
  IaIndisponivelError,
  type PedidoIa,
  type ProvedorLLM,
  type RespostaIa,
  RespostaIaInvalidaError,
} from './provedor.js';

export const TEMPO_LIMITE_PADRAO_MS = 120_000;

export interface OpcoesClaudeCli {
  /** Modelo (ex.: 'haiku', 'sonnet'). Vazio = o padrao do plano. */
  modelo?: string;
  tempoLimiteMs?: number;
  /** Para teste: executavel e argumentos antes dos do Claude (ex.: node + script falso). */
  comando?: { executavel: string; prefixo: readonly string[] };
}

/** Saida de `claude -p --output-format json` (so os campos usados). */
const saidaClaude = z.object({
  is_error: z.boolean().optional(),
  subtype: z.string().optional(),
  result: z.string().optional(),
  structured_output: z.unknown().optional(),
});

interface Execucao {
  codigo: number | null;
  stdout: string;
  stderr: string;
  estourouTempo: boolean;
}

function executar(
  executavel: string,
  args: string[],
  entrada: string,
  pasta: string,
  tempoLimiteMs: number,
): Promise<Execucao> {
  return new Promise((resolver, rejeitar) => {
    const filho = spawn(executavel, args, {
      cwd: pasta,
      env: ambienteIsolado(pasta),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let estourouTempo = false;
    const relogio = setTimeout(() => {
      estourouTempo = true;
      filho.kill();
    }, tempoLimiteMs);
    filho.stdout.setEncoding('utf8').on('data', (d: string) => (stdout += d));
    filho.stderr.setEncoding('utf8').on('data', (d: string) => (stderr += d));
    filho.on('error', (erro) => {
      clearTimeout(relogio);
      rejeitar(erro);
    });
    filho.on('close', (codigo) => {
      clearTimeout(relogio);
      resolver({ codigo, stdout, stderr, estourouTempo });
    });
    // O pedido vai pela entrada padrao, nunca pela linha de comando.
    filho.stdin.on('error', () => {
      // O processo pode fechar antes de ler tudo (ex.: erro de login); o "close" decide.
    });
    filho.stdin.end(entrada, 'utf8');
  });
}

/**
 * JSON Schema para o `--json-schema` do Claude. Sem a chave `$schema`: o Zod marca o draft
 * 2020-12, que o validador do Claude Code nao reconhece ("no schema with key or ref"),
 * descoberto no teste ao vivo de 2026-11-11.
 */
export function jsonSchemaPara(schema: z.ZodType): string {
  const gerado = { ...(z.toJSONSchema(schema) as Record<string, unknown>) };
  delete gerado.$schema;
  return JSON.stringify(gerado);
}

/**
 * Le a mensagem de erro do Claude Code e diz o motivo, para o painel orientar quem usa.
 * Recebe so texto do proprio programa (stderr, ou `result` quando `is_error`), nunca a resposta
 * do modelo: ela pode vir influenciada por texto de terceiros. A mensagem final tambem nao copia
 * o texto, so o motivo e o codigo de saida.
 */
export function classificarErro(textoDoPrograma: string, codigo: number | null): IaIndisponivelError {
  const t = textoDoPrograma.toLowerCase();
  if (/log ?in|logged in|authenticat|credential|oauth|token (expired|invalid)/.test(t)) {
    return new IaIndisponivelError('sem_login', 'O Claude Code não está logado. Rode "claude" uma vez e entre com o seu plano.');
  }
  if (/usage limit|rate limit|limit reached|too many requests|\b429\b|quota/.test(t)) {
    return new IaIndisponivelError('limite', 'O limite de uso do seu plano do Claude acabou por agora.');
  }
  return new IaIndisponivelError(
    'falha',
    `O Claude Code falhou (código de saída ${codigo ?? 'desconhecido'}). Rode "claude" no terminal para ver o problema.`,
  );
}

/**
 * O Claude pelo binario oficial `claude -p`, com o login de quem usa. Cada chamada e isolada
 * (binario.ts) e a resposta e validada duas vezes: pelo `--json-schema` e pelo schema Zod.
 */
export class ClaudeCli implements ProvedorLLM {
  readonly nome = 'claude';

  constructor(private readonly opcoes: OpcoesClaudeCli = {}) {}

  async perguntar<T>(pedido: PedidoIa<T>): Promise<RespostaIa<T>> {
    const executavel = this.opcoes.comando?.executavel ?? acharClaude();
    const prefixo = this.opcoes.comando?.prefixo ?? [];
    conferirIsolamento(executavel, prefixo);

    const jsonSchema = jsonSchemaPara(pedido.schema);
    const inicio = Date.now();
    const execucao = await emPastaIsoladaAsync(async (pasta) => {
      const arquivoSistema = join(pasta, 'sistema.md');
      writeFileSync(arquivoSistema, pedido.sistema, 'utf8');
      const args = [...prefixo, ...montarArgumentos({ arquivoSistema, jsonSchema, modelo: this.opcoes.modelo })];
      try {
        return await executar(
          executavel,
          args,
          pedido.mensagem,
          pasta,
          this.opcoes.tempoLimiteMs ?? TEMPO_LIMITE_PADRAO_MS,
        );
      } catch (erro) {
        throw new IaIndisponivelError('nao_instalado', `Não consegui iniciar o Claude Code (${executavel}).`, {
          cause: erro,
        });
      }
    });
    const duracaoMs = Date.now() - inicio;

    if (execucao.estourouTempo) {
      throw new IaIndisponivelError('tempo', `O Claude não respondeu em ${Math.round((this.opcoes.tempoLimiteMs ?? TEMPO_LIMITE_PADRAO_MS) / 1000)} s.`);
    }

    let saida: z.infer<typeof saidaClaude> | null = null;
    try {
      const r = saidaClaude.safeParse(JSON.parse(execucao.stdout));
      saida = r.success ? r.data : null;
    } catch {
      saida = null;
    }
    if (!saida) {
      if (execucao.codigo !== 0) throw classificarErro(execucao.stderr, execucao.codigo);
      throw new RespostaIaInvalidaError('O Claude não devolveu o JSON de saída esperado.');
    }
    if (saida.is_error || (saida.subtype && saida.subtype !== 'success') || execucao.codigo !== 0) {
      // `result` so e mensagem do programa quando is_error; senao e texto do modelo.
      const doPrograma = `${saida.is_error ? (saida.result ?? '') : ''} ${execucao.stderr}`;
      throw classificarErro(doPrograma, execucao.codigo);
    }

    const dados = pedido.schema.safeParse(saida.structured_output);
    if (!dados.success) {
      // So a quantidade de problemas: nomes de campo e valores podem vir do modelo.
      throw new RespostaIaInvalidaError(`Resposta fora do formato pedido (${dados.error.issues.length} problema(s)).`);
    }
    return { dados: dados.data, duracaoMs };
  }
}

