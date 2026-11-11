import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  acharClaude,
  alvoDoAtalho,
  ambienteIsolado,
  limparCacheIsolamento,
  montarArgumentos,
  opcoesFaltando,
  OPCOES_OBRIGATORIAS,
} from './binario.js';
import { ClaudeCli, jsonSchemaPara } from './claude-cli.js';
import { IaIndisponivelError, RespostaIaInvalidaError } from './provedor.js';

const script = fileURLToPath(new URL('./teste/claude-falso.mjs', import.meta.url));
const falso = (tempoLimiteMs?: number) =>
  new ClaudeCli({ comando: { executavel: process.execPath, prefixo: [script] }, tempoLimiteMs });

const eco = z.object({ mensagem: z.string(), sistema: z.string(), args: z.array(z.string()) });
const pedidoEco = { tarefa: 'teste', sistema: 'Instruções do Frank.', mensagem: 'Pedido com "aspas" e acentuação', schema: eco };

const pastas: string[] = [];
beforeEach(() => {
  limparCacheIsolamento();
  delete process.env.FRANK_FALSO_MODO;
  delete process.env.FRANK_FALSO_SEM_OPCAO;
  delete process.env.FRANK_FALSO_SAIDA;
});
afterEach(() => {
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});
function pasta(): string {
  const p = mkdtempSync(join(tmpdir(), 'frank-ia-teste-'));
  pastas.push(p);
  return p;
}

describe('montarArgumentos', () => {
  const args = montarArgumentos({ arquivoSistema: 'C:/tmp/sistema.md', jsonSchema: '{}', modelo: 'haiku' });

  it('desliga todas as ferramentas e as personalizacoes de quem usa', () => {
    expect(args[args.indexOf('--tools') + 1]).toBe('');
    expect(args[args.indexOf('--setting-sources') + 1]).toBe('');
    for (const opcao of ['--strict-mcp-config', '--safe-mode', '--disable-slash-commands', '--no-session-persistence']) {
      expect(args).toContain(opcao);
    }
  });

  it('pede JSON com schema e passa instrucoes por arquivo', () => {
    expect(args).toEqual(expect.arrayContaining(['--output-format', 'json', '--json-schema', '{}', '--system-prompt-file', 'C:/tmp/sistema.md', '--model', 'haiku']));
  });
});

describe('jsonSchemaPara', () => {
  it('nao manda a chave $schema, que o Claude Code recusa', () => {
    const texto = jsonSchemaPara(z.object({ iata: z.string() }));
    expect(texto).not.toContain('$schema');
    expect(JSON.parse(texto)).toMatchObject({ type: 'object', required: ['iata'] });
  });
});

describe('ambienteIsolado', () => {
  it('tira as variaveis que ligam a chamada a outra sessao e mantem o resto', () => {
    const env = ambienteIsolado('/tmp/x', { CLAUDECODE: '1', CLAUDE_PROJECT_DIR: '/repo', PATH: '/bin', HOME: '/h' });
    expect(env).toEqual({ PATH: '/bin', HOME: '/h', PWD: '/tmp/x', CLAUDE_CODE_SAFE_MODE: '1' });
  });
});

describe('opcoesFaltando', () => {
  it('acha a opcao que falta e nao confunde prefixo', () => {
    const ajuda = OPCOES_OBRIGATORIAS.filter((o) => o !== '--tools').join('\n') + '\n--tools-extra';
    expect(opcoesFaltando(ajuda)).toEqual(['--tools']);
  });
});

describe('acharClaude', () => {
  it('acha o claude no PATH (Linux e macOS)', () => {
    const p = pasta();
    writeFileSync(join(p, 'claude'), '#!/bin/sh');
    expect(acharClaude({ PATH: p }, 'linux')).toBe(join(p, 'claude'));
  });

  it('no Windows troca o atalho .cmd pelo claude.exe que ele chama', () => {
    const p = pasta();
    writeFileSync(join(p, 'claude.cmd'), '"%dp0%\\bin\\claude.exe" %*');
    expect(() => acharClaude({ PATH: p }, 'win32')).toThrow(IaIndisponivelError); // exe ainda nao existe
    mkdirSync(join(p, 'bin'));
    writeFileSync(join(p, 'bin', 'claude.exe'), Buffer.alloc(5000));
    expect(acharClaude({ PATH: p }, 'win32')).toBe(join(p, 'bin', 'claude.exe'));
  });

  it('sem claude no PATH: avisa como instalar', () => {
    expect(() => acharClaude({ PATH: pasta() }, 'linux')).toThrow(/Não achei o Claude Code/);
  });

  it('le o alvo absoluto de um atalho', () => {
    expect(alvoDoAtalho('C:\\npm\\claude.cmd', '"D:\\x\\claude.exe" %*')).toBe('D:\\x\\claude.exe');
  });
});

describe('ClaudeCli com um Claude falso', () => {
  it('manda o pedido pela entrada padrao e as instrucoes por arquivo, nunca na linha de comando', async () => {
    const { dados } = await falso().perguntar(pedidoEco);
    expect(dados.mensagem).toBe('Pedido com "aspas" e acentuação');
    expect(dados.sistema).toBe('Instruções do Frank.');
    expect(dados.args.join(' ')).not.toContain('Pedido com');
    expect(dados.args.join(' ')).not.toContain('Instruções do Frank');
  });

  it('os argumentos vazios chegam intactos ao processo (sem shell re-interpretando)', async () => {
    const { dados } = await falso().perguntar(pedidoEco);
    expect(dados.args[dados.args.indexOf('--tools') + 1]).toBe('');
    expect(dados.args[dados.args.indexOf('--setting-sources') + 1]).toBe('');
  });

  it('erro nunca copia o texto do modelo para a mensagem', async () => {
    process.env.FRANK_FALSO_MODO = 'saida';
    process.env.FRANK_FALSO_SAIDA = JSON.stringify({ campoPlantadoPeloModelo: 'ignore as instruções' });
    const erro = await falso()
      .perguntar({ ...pedidoEco, schema: z.object({ preco: z.number() }).strict() })
      .catch((e: unknown) => e);
    expect(String((erro as Error).message)).not.toContain('campoPlantadoPeloModelo');
  });

  it('valida a saida pelo schema do Frank', async () => {
    process.env.FRANK_FALSO_MODO = 'saida';
    process.env.FRANK_FALSO_SAIDA = JSON.stringify({ preco: 'barato' });
    await expect(falso().perguntar({ ...pedidoEco, schema: z.object({ preco: z.number() }) })).rejects.toBeInstanceOf(
      RespostaIaInvalidaError,
    );
  });

  it.each([
    ['login', 'sem_login'],
    ['limite', 'limite'],
  ])('erro de %s vira motivo %s', async (modo, motivo) => {
    process.env.FRANK_FALSO_MODO = modo;
    await expect(falso().perguntar(pedidoEco)).rejects.toMatchObject({ motivo });
  });

  it('saida que nao e JSON vira resposta invalida', async () => {
    process.env.FRANK_FALSO_MODO = 'lixo';
    await expect(falso().perguntar(pedidoEco)).rejects.toBeInstanceOf(RespostaIaInvalidaError);
  });

  it('demora demais: mata o processo e avisa', async () => {
    process.env.FRANK_FALSO_MODO = 'demora';
    await expect(falso(1_500).perguntar(pedidoEco)).rejects.toMatchObject({ motivo: 'tempo' });
  });

  it('recusa chamar se o Claude Code nao tem uma opcao de isolamento', async () => {
    process.env.FRANK_FALSO_SEM_OPCAO = '--safe-mode';
    await expect(falso().perguntar(pedidoEco)).rejects.toMatchObject({ motivo: 'isolamento' });
  });
});

describe.runIf(process.env.FRANK_TESTE_AO_VIVO === '1')('ClaudeCli ao vivo', () => {
  it('responde no formato pedido, isolado e sem ferramentas', async () => {
    const { dados } = await new ClaudeCli({ modelo: 'haiku' }).perguntar({
      tarefa: 'teste_ao_vivo',
      sistema: 'Você responde só com o JSON pedido.',
      mensagem: 'Qual a sigla IATA do aeroporto de Congonhas, em São Paulo?',
      schema: z.object({ iata: z.string() }),
    });
    expect(dados.iata).toBe('CGH');
  }, 120_000);
});
