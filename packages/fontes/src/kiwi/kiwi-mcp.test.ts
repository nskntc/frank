import { readFileSync } from 'node:fs';
import { lerDia } from '@frank/dominio';
import { describe, expect, it } from 'vitest';
import {
  FonteIndisponivelError,
  RespostaInvalidaError,
  semResposta,
  type ConsultaVoo,
} from '../fonte.js';
import { KiwiMcp, lerResposta, montarArgumentos } from './kiwi-mcp.js';

const gravada = readFileSync(new URL('./fixtures/busca-sao-rec.sse.txt', import.meta.url), 'utf8');

const consulta: ConsultaVoo = {
  origem: 'Sao Paulo',
  destino: 'Recife',
  ida: lerDia('2027-03-12'),
  volta: lerDia('2027-03-19'),
  adultos: 1,
  moeda: 'BRL',
};

function respostaSse(objeto: unknown): string {
  return `event: message\ndata: ${JSON.stringify(objeto)}\n\n`;
}

describe('montarArgumentos', () => {
  it('converte datas e campos para o formato da Kiwi', () => {
    expect(montarArgumentos(consulta)).toMatchObject({
      flyFrom: 'Sao Paulo',
      flyTo: 'Recife',
      departureDate: '12/03/2027',
      returnDate: '19/03/2027',
      adults: 1,
      currency: 'BRL',
      sort: 'price',
    });
  });

  it('manda companhias, escalas e malas quando pedidos', () => {
    const args = montarArgumentos({
      ...consulta,
      adultos: 2,
      companhias: ['LA', 'G3'],
      maxEscalas: 0,
      malasDespachadas: 1,
      aceitarPassagensSeparadas: false,
    });
    expect(args).toMatchObject({
      select_airlines: 'LA,G3',
      max_sector_stopovers: 0,
      adults_hold_bags: [1, 1],
      allow_self_transfer: false,
    });
  });
});

describe('montarArgumentos: janelas e exclusao', () => {
  it('manda a janela de datas so quando ela tem mais de um dia', () => {
    const args = montarArgumentos({
      ...consulta,
      idaAte: lerDia('2027-03-14'),
      voltaAte: lerDia('2027-03-19'),
    });
    expect(args).toMatchObject({ departureDate: '12/03/2027', departureDateTo: '14/03/2027' });
    expect(args).not.toHaveProperty('returnDateTo');
  });

  it('exclui companhias, mas a escolha da pessoa tem prioridade', () => {
    expect(montarArgumentos({ ...consulta, excluirCompanhias: ['AD'] })).toMatchObject({
      exclude_airlines: 'AD',
    });
    const ambos = montarArgumentos({ ...consulta, companhias: ['LA'], excluirCompanhias: ['AD'] });
    expect(ambos).toMatchObject({ select_airlines: 'LA' });
    expect(ambos).not.toHaveProperty('exclude_airlines');
  });
});

describe('lerResposta (resposta gravada em 2026-11-10)', () => {
  const itinerarios = lerResposta(gravada);

  it('le os itinerarios', () => {
    expect(itinerarios).toHaveLength(2);
  });

  it('converte o preco para centavos', () => {
    expect(itinerarios[0]?.precoCentavos).toBe(109_200);
    expect(itinerarios[0]?.moeda).toBe('BRL');
  });

  it('mantem ida e volta com aeroportos e companhia', () => {
    const [primeiro] = itinerarios;
    expect(primeiro?.ida).toMatchObject({ de: 'CGH', para: 'REC', escalas: 0 });
    expect(primeiro?.volta).toMatchObject({ de: 'REC', para: 'VCP' });
    expect(primeiro?.ida.trechos[0]?.companhia).toBe('Azul');
  });

  it('le as malas incluidas', () => {
    expect(itinerarios[0]?.malas).toEqual({ item: 1, mao: 1, despachada: 0 });
  });
});

describe('lerResposta com erro', () => {
  it('recusa resposta sem linha data:', () => {
    expect(() => lerResposta('event: message\n\n')).toThrow(RespostaInvalidaError);
  });

  it('erro JSON-RPC vira fonte indisponivel', () => {
    const corpo = respostaSse({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32000, message: 'limite' },
    });
    expect(() => lerResposta(corpo)).toThrow(FonteIndisponivelError);
  });

  it('ferramenta com isError vira fonte indisponivel', () => {
    const corpo = respostaSse({
      jsonrpc: '2.0',
      id: 1,
      result: { isError: true, content: [{ type: 'text', text: 'falhou' }] },
    });
    expect(() => lerResposta(corpo)).toThrow(FonteIndisponivelError);
  });

  it('formato novo da busca vira resposta invalida, nunca lista vazia', () => {
    const corpo = respostaSse({
      jsonrpc: '2.0',
      id: 1,
      result: { content: [{ type: 'text', text: JSON.stringify({ voos: [] }) }] },
    });
    expect(() => lerResposta(corpo)).toThrow(RespostaInvalidaError);
  });

  it('link de compra de outro dominio vira resposta invalida', () => {
    const adulterada = gravada.replace(
      'https://www.kiwi.com/u/exemplo1',
      'https://kiwi.com.exemplo-falso.example/x',
    );
    expect(() => lerResposta(adulterada)).toThrow(RespostaInvalidaError);
  });

  it('link de compra que nao e https vira resposta invalida', () => {
    const adulterada = gravada.replace('https://www.kiwi.com/u/exemplo1', 'javascript:alert(1)');
    expect(() => lerResposta(adulterada)).toThrow(RespostaInvalidaError);
  });
});

describe('KiwiMcp.buscar', () => {
  it('devolve os itinerarios da resposta', async () => {
    const fonte = new KiwiMcp({ fetch: async () => new Response(gravada, { status: 200 }) });
    await expect(fonte.buscar(consulta)).resolves.toHaveLength(2);
  });

  it('HTTP de erro vira fonte indisponivel', async () => {
    const fonte = new KiwiMcp({ fetch: async () => new Response('', { status: 503 }) });
    await expect(fonte.buscar(consulta)).rejects.toBeInstanceOf(FonteIndisponivelError);
  });

  it('falha de rede vira fonte indisponivel', async () => {
    const fonte = new KiwiMcp({
      fetch: async () => {
        throw new TypeError('fetch failed');
      },
    });
    await expect(fonte.buscar(consulta)).rejects.toBeInstanceOf(FonteIndisponivelError);
  });

  it('diz se foi falta de conexao ou tempo limite (issue #23)', async () => {
    const semRede = new KiwiMcp({
      fetch: async () => {
        throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
      },
    });
    await expect(semRede.buscar(consulta)).rejects.toThrow('kiwi: sem conexão (ENOTFOUND)');
    const lenta = new KiwiMcp({
      tempoLimiteMs: 30_000,
      fetch: async () => {
        throw new DOMException('signal timed out', 'TimeoutError');
      },
    });
    await expect(lenta.buscar(consulta)).rejects.toThrow(
      'kiwi: sem resposta em 30 s (tempo limite)',
    );
  });
});

describe('semResposta', () => {
  it('codigo estranho nao entra na mensagem', () => {
    expect(semResposta({ cause: { code: 'https://x?api_key=segredo' } }, 1000)).toBe('sem conexão');
    expect(semResposta(new Error('x'), 1000)).toBe('sem conexão');
  });
});

describe.runIf(process.env.FRANK_TESTE_AO_VIVO === '1')('KiwiMcp ao vivo', () => {
  it('busca Sao Paulo -> Recife na Kiwi de verdade', async () => {
    const itinerarios = await new KiwiMcp().buscar(consulta);
    expect(itinerarios.length).toBeGreaterThan(0);
  }, 60_000);
});
