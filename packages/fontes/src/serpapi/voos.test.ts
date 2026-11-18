import { readFileSync } from 'node:fs';
import { lerDia } from '@frank/dominio';
import { describe, expect, it } from 'vitest';
import { type ConsultaVoo, FonteIndisponivelError } from '../fonte.js';
import { FonteGoogle } from './fonte-google.js';
import { SerpApiGoogleFlights } from './serpapi.js';

const gravada = (nome: string) =>
  readFileSync(new URL(`./fixtures/${nome}.json`, import.meta.url), 'utf8');

function fetchCom(respostas: (url: URL) => unknown, urls: URL[] = []) {
  return async (entrada: string | URL | Request) => {
    const url = new URL(String(entrada));
    urls.push(url);
    return new Response(JSON.stringify(respostas(url)), { status: 200 });
  };
}

const idaEVolta: ConsultaVoo = {
  origem: 'VCP,CGH,GRU',
  destino: 'REC',
  ida: lerDia('2027-03-12'),
  volta: lerDia('2027-03-19'),
  adultos: 1,
  moeda: 'BRL',
};

/** So ida com duas conexoes, a segunda trocando de aeroporto (GRU -> CGH). Dados ficticios. */
const soIda = {
  search_metadata: { google_flights_url: 'https://www.google.com/travel/flights?exemplo' },
  best_flights: [
    {
      flights: [
        {
          departure_airport: { id: 'BEL', time: '2027-03-10 21:40' },
          arrival_airport: { id: 'BSB', time: '2027-03-10 23:50' },
          airline: 'LATAM',
          flight_number: 'LA 4271',
          duration: 130,
        },
        {
          departure_airport: { id: 'BSB', time: '2027-03-11 08:10' },
          arrival_airport: { id: 'GRU', time: '2027-03-11 10:00' },
          airline: 'LATAM',
          flight_number: 'LA 8213',
          duration: 110,
        },
        {
          departure_airport: { id: 'CGH', time: '2027-03-11 13:00' },
          arrival_airport: { id: 'MAO', time: '2027-03-11 16:00' },
          airline: 'Gol',
          flight_number: 'G3 1100',
          duration: 240,
        },
      ],
      total_duration: 1040,
      price: 2517,
    },
    {
      // Codigo de voo ilegivel: fica de fora, sem derrubar as outras opcoes.
      flights: [
        {
          departure_airport: { id: 'BEL', time: '2027-03-10 07:00' },
          arrival_airport: { id: 'MAO', time: '2027-03-10 09:00' },
          airline: 'Exemplo',
          flight_number: '???',
        },
      ],
      price: 900,
    },
  ],
};

const consultaSoIda: ConsultaVoo = {
  origem: 'BEL',
  destino: 'MAO',
  ida: lerDia('2027-03-10'),
  adultos: 2,
  maxEscalas: 2,
  companhias: ['LA', 'G3'],
  moeda: 'BRL',
};

describe('Google Flights como fonte de voos (issue #27)', () => {
  it('so ida: 1 consulta, itinerario no formato do Frank, opcao ilegivel fica de fora', async () => {
    const urls: URL[] = [];
    const s = new SerpApiGoogleFlights({
      chave: 'chave-de-teste',
      fetch: fetchCom(() => soIda, urls),
    });
    const gasto = { consultas: 0 };
    const voos = await s.voos(consultaSoIda, gasto);
    expect(gasto.consultas).toBe(1);
    expect(urls[0]?.searchParams.get('type')).toBe('2');
    expect(urls[0]?.searchParams.get('stops')).toBe('3');
    expect(urls[0]?.searchParams.get('include_airlines')).toBe('LA,G3');
    expect(urls[0]?.searchParams.get('adults')).toBe('2');
    expect(voos).toHaveLength(1);
    const v = voos[0]!;
    expect(v.fonte).toBe('google');
    expect(v.precoCentavos).toBe(251_700);
    expect(v.volta).toBeNull();
    expect(v.linkCompra).toBe('https://www.google.com/travel/flights?exemplo');
    expect(v.ida).toMatchObject({
      de: 'BEL',
      para: 'MAO',
      partida: '2027-03-10T21:40',
      chegada: '2027-03-11T16:00',
      duracaoSegundos: 1040 * 60,
      escalas: 2,
    });
    expect(v.ida.trechos.map((t) => t.numeroVoo)).toEqual(['LA4271', 'LA8213', 'G31100']);
    expect(v.idNaFonte).toBe('LA4271@2027-03-10+LA8213@2027-03-11+G31100@2027-03-11');
  });

  it('ida e volta: 2 consultas, segue a ida mais barata e cada volta traz o preco total', async () => {
    const urls: URL[] = [];
    const s = new SerpApiGoogleFlights({
      chave: 'chave-de-teste',
      fetch: async (entrada) => {
        const url = new URL(String(entrada));
        urls.push(url);
        const nome = url.searchParams.has('departure_token') ? 'busca-volta' : 'busca-ida';
        return new Response(gravada(nome), { status: 200 });
      },
    });
    const gasto = { consultas: 0 };
    const voos = await s.voos(idaEVolta, gasto);
    expect(gasto.consultas).toBe(2);
    expect(urls[0]?.searchParams.get('departure_id')).toBe('VCP,CGH,GRU');
    expect(voos.length).toBe(9);
    // A ida mais barata gravada e a Azul de R$ 975 das 06:05; o preco e o da volta (total).
    expect(new Set(voos.map((v) => v.ida.trechos[0]?.numeroVoo))).toEqual(new Set(['AD4079']));
    expect(voos.map((v) => v.precoCentavos).sort((a, b) => a - b)[0]).toBe(119_500);
    expect(voos.every((v) => v.volta !== null && v.volta.para === 'CGH')).toBe(true);
  });

  it('"nenhum resultado" do Google e lista vazia; outro erro e falha', async () => {
    const vazio = new SerpApiGoogleFlights({
      chave: 'x',
      fetch: fetchCom(() => ({
        error: "Google Flights hasn't returned any results for this query.",
      })),
    });
    expect(await vazio.voos(consultaSoIda)).toEqual([]);
    const ruim = new SerpApiGoogleFlights({
      chave: 'x',
      fetch: fetchCom(() => ({ error: 'Invalid API key.' })),
    });
    await expect(ruim.voos(consultaSoIda)).rejects.toBeInstanceOf(FonteIndisponivelError);
  });

  it('link de fora do Google Flights descarta o voo', async () => {
    const s = new SerpApiGoogleFlights({
      chave: 'x',
      fetch: fetchCom(() => ({
        ...soIda,
        search_metadata: { google_flights_url: 'https://www.google.com/url?q=https://x.example' },
      })),
    });
    expect(await s.voos(consultaSoIda)).toEqual([]);
  });
});

describe('FonteGoogle (cota)', () => {
  const s = new SerpApiGoogleFlights({ chave: 'x', fetch: fetchCom(() => soIda) });

  it('confere a cota antes e registra o que gastou', async () => {
    const gastos: [number, string | undefined][] = [];
    const f = new FonteGoogle(s, { cabe: () => true, gastou: (n, e) => gastos.push([n, e]) });
    expect(await f.buscar(consultaSoIda)).toHaveLength(1);
    expect(gastos).toEqual([[1, undefined]]);
    expect(FonteGoogle.custo(idaEVolta)).toBe(2);
  });

  it('sem cota, falha sem consultar', async () => {
    const urls: URL[] = [];
    const semCota = new FonteGoogle(
      new SerpApiGoogleFlights({ chave: 'x', fetch: fetchCom(() => soIda, urls) }),
      {
        cabe: () => false,
        gastou: () => {},
      },
    );
    await expect(semCota.buscar(consultaSoIda)).rejects.toThrow(/cota/);
    expect(urls).toHaveLength(0);
  });
});
