import {
  abrirBanco,
  atualizarVigilancia,
  type Banco,
  contarConsultas,
  criarVigilancia,
  listarOfertas,
  listarOpcoesCompra,
  registrarConsulta,
} from '@frank/banco';
import type { NovaVigilancia } from '@frank/contratos';
import { FonteIndisponivelError, type ReferenciaRota, type ResultadoOpcoes } from '@frank/fontes';
import { beforeEach, describe, expect, it } from 'vitest';
import { type GoogleFlights, linkGoogleSeguro } from './google.js';
import { executarRodada } from './rodada.js';
import { FonteFalsa, itinerario, logEmMemoria, vigilanciaExemplo } from './teste/apoio.js';

const t0 = new Date('2026-11-11T12:00:00.000Z');
const horas = (h: number) => new Date(t0.getTime() + h * 3_600_000);
let db: Banco;

beforeEach(() => {
  db = abrirBanco(':memory:');
});

/** 30 dias de historico do Google a R$ 1.090. */
function referencia(dias = 30, preco = 109_000): ReferenciaRota {
  return {
    pontos: Array.from({ length: dias }, (_, i) => ({
      dia: new Date(t0.getTime() - (i + 1) * 86_400_000).toISOString().slice(0, 10),
      precoCentavos: preco,
    })),
    faixaTipica: null,
  };
}

function googleFalso(opcoes: Partial<{ historico: () => Promise<ReferenciaRota>; compra: () => Promise<ResultadoOpcoes> }> = {}) {
  const chamadas = { historico: 0, compra: 0 };
  const g: GoogleFlights & { chamadas: typeof chamadas } = {
    chamadas,
    historico: async () => {
      chamadas.historico++;
      return (opcoes.historico ?? (async () => referencia()))();
    },
    opcoesDeCompra: async () => {
      chamadas.compra++;
      return (
        opcoes.compra ??
        (async () => ({
          opcoes: [
            { vendedor: 'Azul', precoCentavos: 76_000, ehCompanhia: true, estrangeiro: false },
            { vendedor: 'Kiwi.com', precoCentavos: 82_000, ehCompanhia: false, estrangeiro: true },
            { vendedor: 'Trip.com', precoCentavos: 84_000, ehCompanhia: false, estrangeiro: true },
          ],
          linkGoogle: 'https://www.google.com/travel/flights?exemplo',
          consultas: 3,
        }))
      )();
    },
  };
  return g;
}

/** Kiwi falsa com o voo AD-1 a `preco`; respeita o filtro de companhia da reconferencia. */
function kiwi(preco: number) {
  // O nome casa com a fonte dos itinerarios de teste ('falsa'); o vendedor imita a Kiwi.
  const f = new FonteFalsa('falsa', async () => [itinerario('AD-1', preco)], undefined, true);
  Object.assign(f, { vendedor: 'Kiwi.com' });
  return f;
}

function vigilancia(mudanca: Partial<NovaVigilancia> = {}) {
  return criarVigilancia(db, { ...vigilanciaExemplo, origens: ['GRU'], ...mudanca }, new Date('2026-11-01T00:00:00Z'));
}

async function rodar(fonte: FonteFalsa, serpapi: GoogleFlights, agora = t0, tetoMensalSerpApi?: number) {
  return executarRodada(
    { db, fontes: [fonte], tetoDiarioPorFonte: 300, serpapi, tetoMensalSerpApi, log: logEmMemoria() },
    agora,
  );
}

describe('referencia do Google para o preco normal (RF-07)', () => {
  it('sem historico proprio, o normal vem do Google desde a primeira rodada', async () => {
    vigilancia(); // sem preco-alvo: so o "abaixo do normal" pode criar oferta
    const g = googleFalso();
    const resumo = await rodar(kiwi(80_000), g);
    expect(g.chamadas.historico).toBe(1);
    expect(resumo.ofertas).toBe(1);
    expect(listarOfertas(db)[0]).toMatchObject({ precoNormalCentavos: 109_000, motivos: ['abaixo_do_normal'] });
  });

  it('busca o historico uma vez so na semana', async () => {
    vigilancia();
    const g = googleFalso();
    await rodar(kiwi(100_000), g, t0);
    await rodar(kiwi(100_000), g, horas(2));
    await rodar(kiwi(100_000), g, horas(24 * 3));
    expect(g.chamadas.historico).toBe(1);
    await rodar(kiwi(100_000), g, horas(24 * 8));
    expect(g.chamadas.historico).toBe(2);
  });

  it('mudou a rota: busca de novo e esquece os pontos antigos', async () => {
    const v = vigilancia();
    const g = googleFalso();
    await rodar(kiwi(100_000), g, t0);
    atualizarVigilancia(db, v.id, { ...vigilanciaExemplo, origens: ['GRU'], destinos: ['SSA'] }, horas(1));
    await rodar(kiwi(100_000), g, horas(2));
    expect(g.chamadas.historico).toBe(2);
  });

  it('historico curto demais (menos de 10 dias) nao vale como normal', async () => {
    vigilancia();
    const g = googleFalso({ historico: async () => referencia(5) });
    expect((await rodar(kiwi(50_000), g)).ofertas).toBe(0);
  });

  it('falha do Google nao para a rodada; tenta de novo so no dia seguinte', async () => {
    vigilancia();
    const g = googleFalso({
      historico: async () => {
        throw new FonteIndisponivelError('serpapi', 'cota do plano esgotada');
      },
    });
    await rodar(kiwi(100_000), g, t0);
    await rodar(kiwi(100_000), g, horas(2));
    expect(g.chamadas.historico).toBe(1);
    await rodar(kiwi(100_000), g, horas(25));
    expect(g.chamadas.historico).toBe(2);
  });
});

describe('linkGoogleSeguro', () => {
  it('aceita so a area de voos do Google, em https', () => {
    expect(linkGoogleSeguro('https://www.google.com/travel/flights?x=1')).toBe('https://www.google.com/travel/flights?x=1');
    expect(linkGoogleSeguro('https://www.google.com/url?q=https://site-falso.example')).toBeNull();
    expect(linkGoogleSeguro('http://www.google.com/travel/flights')).toBeNull();
    expect(linkGoogleSeguro('https://google.com.site-falso.example/travel/flights')).toBeNull();
  });
});

describe('onde comprar (RF-12)', () => {
  it('grava a opcao da fonte com o link dela e o preco em cada vendedor do Google', async () => {
    vigilancia({ precoAlvoCentavos: 90_000 });
    await rodar(kiwi(80_000), googleFalso());
    const [oferta] = listarOfertas(db);
    const opcoes = listarOpcoesCompra(db, oferta!.id);
    expect(opcoes.map((o) => [o.vendedor, o.precoCentavos, o.estrangeiro, o.ehCompanhia])).toEqual([
      ['Azul', 76_000, false, true],
      ['Kiwi.com', 80_000, true, false],
      ['Trip.com', 84_000, true, false],
    ]);
    expect(opcoes.find((o) => o.vendedor === 'Kiwi.com')?.link).toBe('https://example.com/AD-1');
    expect(opcoes.find((o) => o.vendedor === 'Azul')?.link).toBe('https://www.google.com/travel/flights?exemplo');
  });

  it('link que nao e do Google nao entra', async () => {
    vigilancia({ precoAlvoCentavos: 90_000 });
    const g = googleFalso({
      compra: async () => ({
        opcoes: [{ vendedor: 'Azul', precoCentavos: 76_000, ehCompanhia: true, estrangeiro: false }],
        linkGoogle: 'https://exemplo-falso.example/compre',
        consultas: 3,
      }),
    });
    await rodar(kiwi(80_000), g);
    const azul = listarOpcoesCompra(db, listarOfertas(db)[0]!.id).find((o) => o.vendedor === 'Azul');
    expect(azul?.link).toBeNull();
  });

  it('sem SerpApi ou sem cota: fica so a opcao da fonte', async () => {
    vigilancia({ precoAlvoCentavos: 90_000 });
    const g = googleFalso();
    for (let i = 0; i < 239; i++) registrarConsulta(db, 'serpapi', { sucesso: true }, horas(-1));
    await rodar(kiwi(80_000), g);
    expect(g.chamadas.compra).toBe(0);
    expect(listarOpcoesCompra(db, listarOfertas(db)[0]!.id).map((o) => o.vendedor)).toEqual(['Kiwi.com']);
  });

  it('cada consulta ao SerpApi conta no teto mensal', async () => {
    vigilancia({ precoAlvoCentavos: 90_000 });
    await rodar(kiwi(80_000), googleFalso());
    expect(contarConsultas(db, 'serpapi', new Date(0))).toBe(1 + 3); // historico + opcoes
  });
});
