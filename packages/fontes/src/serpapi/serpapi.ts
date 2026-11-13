import type { Itinerario, Perna } from '@frank/contratos';
import { type Centavos, reaisParaCentavos } from '@frank/dominio';
import { z } from 'zod';
import { type ConsultaVoo, FonteIndisponivelError, RespostaInvalidaError, semResposta } from '../fonte.js';
import { buscaGoogle, type OpcaoGoogle, reservaGoogle } from './formato.js';
import { vendedorEstrangeiro } from './vendedores.js';

const NOME = 'serpapi';
const NOME_VENDEDOR = /^[^\p{Cc}]{1,60}$/u;
const URL_PADRAO = 'https://serpapi.com/search.json';
const TEMPO_LIMITE_MS = 60_000;

export interface OpcoesSerpApi {
  /** Chave do SerpApi (SERPAPI_API_KEY). Nunca vai para log nem mensagem de erro. */
  chave: string;
  url?: string;
  tempoLimiteMs?: number;
  fetch?: typeof fetch;
}

export interface ReferenciaRota {
  /** Historico de ~60 dias do Google: menor preco da rota por dia, em centavos. */
  pontos: { dia: string; precoCentavos: Centavos }[];
  faixaTipica: { minCentavos: Centavos; maxCentavos: Centavos } | null;
}

export interface OpcaoDeCompra {
  vendedor: string;
  precoCentavos: Centavos;
  /** A propria companhia aerea vende (o Google marca). */
  ehCompanhia: boolean;
  estrangeiro: boolean;
}

export interface ResultadoOpcoes {
  opcoes: OpcaoDeCompra[];
  /** Busca no Google Flights, para a pessoa abrir. */
  linkGoogle: string | null;
  /** Consultas gastas (para o teto mensal). */
  consultas: number;
}

/** "LA 3414" e "LA3414" sao o mesmo voo. */
export function normalizarVoo(numero: string): string {
  return numero.replace(/\s+/g, '').toUpperCase();
}

function voosDaPerna(perna: Perna): string[] {
  return perna.trechos.map((t) => normalizarVoo(t.numeroVoo));
}

function casa(opcao: OpcaoGoogle, perna: Perna): boolean {
  const esperados = voosDaPerna(perna);
  const achados = opcao.flights.map((f) => normalizarVoo(f.flight_number));
  return esperados.length === achados.length && esperados.every((v, i) => v === achados[i]);
}

/**
 * Google Flights via SerpApi. Nao e fonte do vigia (o radar e a Kiwi): serve para o historico
 * da rota (RF-07) e para o preco em cada vendedor quando ja ha uma oferta (RF-12).
 */
export class SerpApiGoogleFlights {
  readonly nome = NOME;

  constructor(private readonly opcoes: OpcoesSerpApi) {
    if (!opcoes.chave) throw new Error('SerpApi sem chave (SERPAPI_API_KEY).');
  }

  private parametrosBase(c: ConsultaVoo, origens: string, destinos: string): Record<string, string> {
    return {
      engine: 'google_flights',
      departure_id: origens,
      arrival_id: destinos,
      outbound_date: c.ida,
      ...(c.volta ? { return_date: c.volta, type: '1' } : { type: '2' }),
      adults: String(c.adultos),
      currency: c.moeda,
      hl: 'pt-br',
      gl: 'br',
    };
  }

  private async chamar<T>(parametros: Record<string, string>, schema: z.ZodType<T>): Promise<T> {
    const url = new URL(this.opcoes.url ?? URL_PADRAO);
    for (const [k, v] of Object.entries(parametros)) url.searchParams.set(k, v);
    url.searchParams.set('api_key', this.opcoes.chave);
    let resposta: Response;
    try {
      resposta = await (this.opcoes.fetch ?? fetch)(url, {
        signal: AbortSignal.timeout(this.opcoes.tempoLimiteMs ?? TEMPO_LIMITE_MS),
      });
    } catch (erro) {
      // Mensagem sem a URL: ela carrega a chave.
      throw new FonteIndisponivelError(NOME, semResposta(erro, this.opcoes.tempoLimiteMs ?? TEMPO_LIMITE_MS), {
        cause: erro,
      });
    }
    if (resposta.status === 401 || resposta.status === 403) {
      throw new FonteIndisponivelError(NOME, 'chave recusada (confira SERPAPI_API_KEY)');
    }
    if (resposta.status === 429) throw new FonteIndisponivelError(NOME, 'cota do plano esgotada');
    if (!resposta.ok) throw new FonteIndisponivelError(NOME, `HTTP ${resposta.status}`);
    let json: unknown;
    try {
      json = await resposta.json();
    } catch (erro) {
      throw new RespostaInvalidaError(NOME, 'resposta nao e JSON', { cause: erro });
    }
    const r = schema.safeParse(json);
    if (!r.success) throw new RespostaInvalidaError(NOME, `formato mudou: ${z.prettifyError(r.error).slice(0, 200)}`);
    return r.data;
  }

  /** Historico da rota (1 consulta). `origens` e `destinos`: codigos IATA. */
  async historico(consulta: ConsultaVoo, origens: string[], destinos: string[]): Promise<ReferenciaRota> {
    const busca = await this.chamar(
      this.parametrosBase(consulta, origens.join(','), destinos.join(',')),
      buscaGoogle,
    );
    if (busca.error) return { pontos: [], faixaTipica: null };
    const insights = busca.price_insights;
    const porDia = new Map<string, Centavos>();
    for (const [segundos, preco] of insights?.price_history ?? []) {
      porDia.set(new Date(segundos * 1000).toISOString().slice(0, 10), reaisParaCentavos(preco));
    }
    const faixa = insights?.typical_price_range;
    return {
      pontos: [...porDia].map(([dia, precoCentavos]) => ({ dia, precoCentavos })),
      faixaTipica: faixa ? { minCentavos: reaisParaCentavos(faixa[0]), maxCentavos: reaisParaCentavos(faixa[1]) } : null,
    };
  }

  /**
   * Preco do mesmo voo em cada vendedor (2 consultas so ida, 3 ida e volta). O voo e achado
   * pelos numeros de voo de cada trecho. Nao achou: devolve lista vazia (o painel usa os links).
   */
  async opcoesDeCompra(
    consulta: ConsultaVoo,
    itinerario: Itinerario,
    /** Conta cada chamada tentada, inclusive se uma falhar no meio (o teto mensal nao subconta). */
    gasto: { consultas: number } = { consultas: 0 },
  ): Promise<ResultadoOpcoes> {
    const base = this.parametrosBase(consulta, itinerario.ida.de, itinerario.ida.para);
    const vazio = (link: string | null): ResultadoOpcoes => ({ opcoes: [], linkGoogle: link, consultas: gasto.consultas });

    gasto.consultas++;
    const ida = await this.chamar(base, buscaGoogle);
    const link = ida.search_metadata?.google_flights_url ?? null;
    const opcaoIda = [...(ida.best_flights ?? []), ...(ida.other_flights ?? [])].find((o) => casa(o, itinerario.ida));
    if (!opcaoIda) return vazio(link);

    let token = opcaoIda.booking_token;
    if (itinerario.volta) {
      if (!opcaoIda.departure_token) return vazio(link);
      gasto.consultas++;
      const volta = await this.chamar({ ...base, departure_token: opcaoIda.departure_token }, buscaGoogle);
      const voltaDoItinerario = itinerario.volta;
      const opcaoVolta = [...(volta.best_flights ?? []), ...(volta.other_flights ?? [])].find((o) =>
        casa(o, voltaDoItinerario),
      );
      token = opcaoVolta?.booking_token;
    }
    if (!token) return vazio(link);

    gasto.consultas++;
    const reserva = await this.chamar({ ...base, booking_token: token }, reservaGoogle);
    const opcoes: OpcaoDeCompra[] = [];
    for (const o of reserva.booking_options ?? []) {
      const t = o.together;
      if (!t || t.price === undefined) continue;
      // Nome de terceiro que vai para a tela: curto e sem caractere de controle, senao fica de fora.
      const vendedor = t.book_with.trim();
      if (!NOME_VENDEDOR.test(vendedor)) continue;
      opcoes.push({
        vendedor,
        precoCentavos: reaisParaCentavos(t.price),
        ehCompanhia: t.airline === true,
        estrangeiro: vendedorEstrangeiro(t.book_with),
      });
    }
    opcoes.sort((a, b) => a.precoCentavos - b.precoCentavos);
    return { opcoes, linkGoogle: reserva.search_metadata?.google_flights_url ?? link, consultas: gasto.consultas };
  }
}
