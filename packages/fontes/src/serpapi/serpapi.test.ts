import { readFileSync } from 'node:fs';
import type { Itinerario, Perna } from '@frank/contratos';
import { lerDia } from '@frank/dominio';
import { describe, expect, it } from 'vitest';
import { type ConsultaVoo, FonteIndisponivelError } from '../fonte.js';
import { normalizarVoo, SerpApiGoogleFlights } from './serpapi.js';
import { vendedorEstrangeiro } from './vendedores.js';

const gravada = (nome: string) => readFileSync(new URL(`./fixtures/${nome}.json`, import.meta.url), 'utf8');

/** Responde como o SerpApi gravado em 2026-11-11, pelo tipo de chamada. Guarda as URLs. */
function fetchGravado(urls: URL[] = []) {
  return async (entrada: string | URL | Request) => {
    const url = new URL(String(entrada));
    urls.push(url);
    const nome = url.searchParams.has('booking_token')
      ? 'reserva'
      : url.searchParams.has('departure_token')
        ? 'busca-volta'
        : 'busca-ida';
    return new Response(gravada(nome), { status: 200 });
  };
}

const consulta: ConsultaVoo = {
  origem: 'CGH',
  destino: 'REC',
  ida: lerDia('2027-03-12'),
  volta: lerDia('2027-03-19'),
  adultos: 1,
  moeda: 'BRL',
};

function perna(...trechos: [string, string, string, string][]): Perna {
  const t = trechos.map(([de, para, partida, numeroVoo]) => ({
    de,
    para,
    partida,
    chegada: partida,
    companhia: 'LATAM',
    codigoCompanhia: 'LA',
    numeroVoo,
  }));
  return { de: t[0]!.de, para: t.at(-1)!.para, partida: t[0]!.partida, chegada: t.at(-1)!.chegada, duracaoSegundos: 1, escalas: t.length - 1, trechos: t };
}

/** O voo LATAM CGH -> REC 10:45 (LA3414), volta por Brasilia (LA3425 + LA3023), visto na Kiwi. */
const itinerarioLatam: Itinerario = {
  fonte: 'kiwi',
  idNaFonte: 'exemplo',
  precoCentavos: 137_200,
  moeda: 'BRL',
  linkCompra: 'https://www.kiwi.com/u/exemplo',
  malas: { item: 1, mao: 1, despachada: 0 },
  ida: perna(['CGH', 'REC', '2027-03-12T10:45:00', 'LA3414']),
  volta: perna(['REC', 'BSB', '2027-03-19T17:20:00', 'LA3425'], ['BSB', 'CGH', '2027-03-19T20:35:00', 'LA3023']),
};

const serpapi = (urls?: URL[]) => new SerpApiGoogleFlights({ chave: 'chave-de-teste', fetch: fetchGravado(urls) });

describe('historico', () => {
  it('le os ~60 dias de preco e a faixa tipica, em centavos', async () => {
    const r = await serpapi().historico(consulta, ['GRU', 'CGH', 'VCP'], ['REC']);
    expect(r.pontos.length).toBeGreaterThan(50);
    expect(r.pontos[0]).toEqual({ dia: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), precoCentavos: 90_100 });
    expect(r.faixaTipica).toEqual({ minCentavos: 91_000, maxCentavos: 170_000 });
  });

  it('manda varias origens numa busca so', async () => {
    const urls: URL[] = [];
    await serpapi(urls).historico(consulta, ['GRU', 'CGH', 'VCP'], ['REC']);
    expect(urls[0]?.searchParams.get('departure_id')).toBe('GRU,CGH,VCP');
    expect(urls[0]?.searchParams.get('type')).toBe('1');
  });
});

describe('opcoesDeCompra', () => {
  it('acha o mesmo voo pelos numeros e devolve cada vendedor, do mais barato ao mais caro', async () => {
    const r = await serpapi().opcoesDeCompra(consulta, itinerarioLatam);
    expect(r.consultas).toBe(3);
    expect(r.opcoes[0]).toEqual({ vendedor: 'LATAM', precoCentavos: 119_500, ehCompanhia: true, estrangeiro: false });
    expect(r.opcoes.find((o) => o.vendedor === 'Kiwi.com')).toMatchObject({ precoCentavos: 137_200, estrangeiro: true });
    expect(r.linkGoogle).toContain('google.com/travel/flights');
  });

  it('voo que nao aparece no Google: lista vazia, sem gastar a consulta da reserva', async () => {
    const outro = { ...itinerarioLatam, ida: perna(['CGH', 'REC', '2027-03-12T10:45:00', 'XX9999']) };
    const r = await serpapi().opcoesDeCompra(consulta, outro);
    expect(r).toMatchObject({ opcoes: [], consultas: 1 });
  });

  it('conta as chamadas feitas mesmo quando a ultima falha', async () => {
    let n = 0;
    const fonte = new SerpApiGoogleFlights({
      chave: 'x',
      fetch: async (entrada) => {
        if (++n === 3) return new Response('', { status: 503 });
        return fetchGravado()(entrada);
      },
    });
    const gasto = { consultas: 0 };
    await expect(fonte.opcoesDeCompra(consulta, itinerarioLatam, gasto)).rejects.toBeInstanceOf(FonteIndisponivelError);
    expect(gasto.consultas).toBe(3);
  });

  it('vendedor com nome longo ou com caractere de controle fica de fora', async () => {
    const reserva = JSON.parse(gravada('reserva')) as { booking_options: { together: { book_with: string } }[] };
    reserva.booking_options[0]!.together.book_with = 'LATAM\n<b>compre aqui</b>';
    reserva.booking_options[1]!.together.book_with = 'x'.repeat(61);
    const fonte = new SerpApiGoogleFlights({
      chave: 'x',
      fetch: async (entrada) =>
        new URL(String(entrada)).searchParams.has('booking_token')
          ? new Response(JSON.stringify(reserva), { status: 200 })
          : fetchGravado()(entrada),
    });
    const r = await fonte.opcoesDeCompra(consulta, itinerarioLatam);
    expect(r.opcoes.some((o) => o.vendedor.includes('<b>') || o.vendedor.length > 60)).toBe(false);
    expect(r.opcoes.length).toBe(10);
  });

  it('nunca poe a chave na mensagem de erro', async () => {
    const fonte = new SerpApiGoogleFlights({
      chave: 'chave-secreta-123',
      fetch: async () => {
        throw new TypeError('fetch failed https://serpapi.com/search.json?api_key=chave-secreta-123');
      },
    });
    const erro = (await fonte.historico(consulta, ['CGH'], ['REC']).catch((e: unknown) => e)) as Error;
    expect(erro).toBeInstanceOf(FonteIndisponivelError);
    expect(erro.message).not.toContain('chave-secreta-123');
  });

  it('chave recusada e cota esgotada viram mensagens claras', async () => {
    const com = (status: number) => new SerpApiGoogleFlights({ chave: 'x', fetch: async () => new Response('{}', { status }) });
    await expect(com(401).historico(consulta, ['CGH'], ['REC'])).rejects.toThrow(/chave recusada/);
    await expect(com(429).historico(consulta, ['CGH'], ['REC'])).rejects.toThrow(/cota/);
  });
});

describe('utilitarios', () => {
  it('normaliza numero de voo', () => {
    expect(normalizarVoo('LA 3414')).toBe(normalizarVoo('la3414'));
  });

  it('classifica vendedores estrangeiros conhecidos', () => {
    expect(['Kiwi.com', 'Trip.com', 'Mytrip', 'Booking.com'].map(vendedorEstrangeiro)).toEqual([true, true, true, true]);
    expect(['LATAM', 'Decolar', 'Zupper', 'maxmilhas', 'Desconhecida'].map(vendedorEstrangeiro)).toEqual([false, false, false, false, false]);
  });
});
