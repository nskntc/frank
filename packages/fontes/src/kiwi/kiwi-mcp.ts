import { type Itinerario, itinerarioSchema, type Perna } from '@frank/contratos';
import { reaisParaCentavos } from '@frank/dominio';
import { z } from 'zod';
import {
  type ConsultaVoo,
  type FontePreco,
  FonteIndisponivelError,
  RespostaInvalidaError,
} from '../fonte.js';
import { type ItinerarioKiwi, respostaRpcKiwi, resultadoBuscaKiwi } from './formato.js';

const NOME = 'kiwi';
const URL_PADRAO = 'https://mcp.kiwi.com';
const TEMPO_LIMITE_MS = 30_000;

export interface OpcoesKiwi {
  url?: string;
  tempoLimiteMs?: number;
  /** Injetavel para teste. */
  fetch?: typeof fetch;
}

/** AAAA-MM-DD -> DD/MM/AAAA, o formato que a Kiwi pede. */
function dataKiwi(dia: string): string {
  const [ano, mes, d] = dia.split('-');
  return `${d}/${mes}/${ano}`;
}

export function montarArgumentos(consulta: ConsultaVoo): Record<string, unknown> {
  const args: Record<string, unknown> = {
    flyFrom: consulta.origem,
    flyTo: consulta.destino,
    departureDate: dataKiwi(consulta.ida),
    adults: consulta.adultos,
    currency: consulta.moeda,
    locale: 'pt',
    sort: 'price',
  };
  if (consulta.idaAte && consulta.idaAte !== consulta.ida) {
    args.departureDateTo = dataKiwi(consulta.idaAte);
  }
  if (consulta.volta) args.returnDate = dataKiwi(consulta.volta);
  if (consulta.volta && consulta.voltaAte && consulta.voltaAte !== consulta.volta) {
    args.returnDateTo = dataKiwi(consulta.voltaAte);
  }
  if (consulta.maxEscalas !== undefined) args.max_sector_stopovers = consulta.maxEscalas;
  // A Kiwi nao aceita os dois juntos; `companhias` (escolha da pessoa) tem prioridade.
  if (consulta.companhias?.length) args.select_airlines = consulta.companhias.join(',');
  else if (consulta.excluirCompanhias?.length) args.exclude_airlines = consulta.excluirCompanhias.join(',');
  if (consulta.aceitarPassagensSeparadas !== undefined) {
    args.allow_self_transfer = consulta.aceitarPassagensSeparadas;
  }
  if (consulta.malasDespachadas !== undefined) {
    args.adults_hold_bags = Array.from({ length: consulta.adultos }, () => consulta.malasDespachadas);
  }
  return args;
}

/** O MCP responde em text/event-stream: o JSON vem nas linhas `data:`. */
export function lerEventStream(corpo: string): unknown {
  const dados = corpo
    .split(/\r?\n/)
    .filter((linha) => linha.startsWith('data:'))
    .map((linha) => linha.slice(5).trim())
    .join('');
  if (!dados) throw new RespostaInvalidaError(NOME, 'resposta sem linha "data:"');
  try {
    return JSON.parse(dados);
  } catch (erro) {
    throw new RespostaInvalidaError(NOME, 'JSON invalido na resposta', { cause: erro });
  }
}

function converterPerna(perna: NonNullable<ItinerarioKiwi['inbound']>): Perna {
  return {
    de: perna.from,
    para: perna.to,
    partida: perna.departureTime,
    chegada: perna.arrivalTime,
    duracaoSegundos: perna.durationSeconds,
    escalas: perna.stops,
    trechos: perna.segments.map((s) => ({
      de: s.from,
      para: s.to,
      partida: s.departureTime,
      chegada: s.arrivalTime,
      companhia: s.carrierName,
      codigoCompanhia: s.carrier,
      numeroVoo: s.flightNumber,
    })),
  };
}

/** O link de compra da Kiwi so pode ser da propria Kiwi (rotulo "Kiwi.com" no "Onde comprar"). */
export function linkDaKiwi(link: string): boolean {
  try {
    const host = new URL(link).hostname;
    return host === 'kiwi.com' || host.endsWith('.kiwi.com');
  } catch {
    return false;
  }
}

export function converterItinerario(bruto: ItinerarioKiwi, moeda: string): Itinerario {
  if (!linkDaKiwi(bruto.bookingUrl)) throw new Error('link de compra fora do dominio da Kiwi');
  return itinerarioSchema.parse({
    fonte: NOME,
    idNaFonte: bruto.id,
    precoCentavos: reaisParaCentavos(bruto.price),
    moeda,
    linkCompra: bruto.bookingUrl,
    malas: {
      item: bruto.baggage.personalItem,
      mao: bruto.baggage.cabinBag,
      despachada: bruto.baggage.checkedBag,
    },
    ida: converterPerna(bruto.outbound),
    volta: bruto.inbound ? converterPerna(bruto.inbound) : null,
  });
}

/** Le o corpo do MCP e devolve itinerarios validados. Erro de formato vira RespostaInvalidaError. */
export function lerResposta(corpo: string): Itinerario[] {
  const rpc = respostaRpcKiwi.safeParse(lerEventStream(corpo));
  if (!rpc.success) throw new RespostaInvalidaError(NOME, 'envelope JSON-RPC inesperado');
  if (rpc.data.error) {
    throw new FonteIndisponivelError(NOME, `erro ${rpc.data.error.code}: ${rpc.data.error.message}`);
  }
  const resultado = rpc.data.result;
  if (!resultado) throw new RespostaInvalidaError(NOME, 'resposta sem result');
  const texto = resultado.content[0]?.text ?? '';
  if (resultado.isError) throw new FonteIndisponivelError(NOME, `ferramenta falhou: ${texto.slice(0, 200)}`);

  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch (erro) {
    throw new RespostaInvalidaError(NOME, 'resultado da ferramenta nao e JSON', { cause: erro });
  }
  const busca = resultadoBuscaKiwi.safeParse(json);
  if (!busca.success) {
    throw new RespostaInvalidaError(NOME, `formato da busca mudou: ${z.prettifyError(busca.error)}`);
  }
  if (busca.data.error) throw new FonteIndisponivelError(NOME, busca.data.error);

  try {
    return busca.data.itineraries.map((it) => converterItinerario(it, busca.data.currency));
  } catch (erro) {
    throw new RespostaInvalidaError(NOME, 'itinerario fora do formato do Frank', { cause: erro });
  }
}

/** Fonte Kiwi.com pelo servidor MCP publico (sem chave). */
export class KiwiMcp implements FontePreco {
  readonly nome = NOME;
  /** Medido em 2026-11-10: toda busca devolveu no maximo 15 itinerarios. */
  readonly limiteResultados = 15;
  /** Kiwi.com s.r.o., empresa tcheca: o link de compra leva a um vendedor estrangeiro. */
  readonly vendedorEstrangeiro = true;
  readonly vendedor = 'Kiwi.com';
  private proximoId = 1;

  constructor(private readonly opcoes: OpcoesKiwi = {}) {}

  async buscar(consulta: ConsultaVoo): Promise<Itinerario[]> {
    const fazer = this.opcoes.fetch ?? fetch;
    let resposta: Response;
    try {
      resposta = await fazer(this.opcoes.url ?? URL_PADRAO, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: this.proximoId++,
          method: 'tools/call',
          params: { name: 'search-flight', arguments: montarArgumentos(consulta) },
        }),
        signal: AbortSignal.timeout(this.opcoes.tempoLimiteMs ?? TEMPO_LIMITE_MS),
      });
    } catch (erro) {
      throw new FonteIndisponivelError(NOME, 'sem resposta (rede ou tempo limite)', { cause: erro });
    }
    if (!resposta.ok) throw new FonteIndisponivelError(NOME, `HTTP ${resposta.status}`);
    return lerResposta(await resposta.text());
  }
}
