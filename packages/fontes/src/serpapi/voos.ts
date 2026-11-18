import { type Itinerario, itinerarioSchema, type Perna } from '@frank/contratos';
import { reaisParaCentavos } from '@frank/dominio';
import { type ConsultaVoo, FonteIndisponivelError } from '../fonte.js';
import type { BuscaGoogle, OpcaoGoogle } from './formato.js';

/**
 * Conversao do Google Flights (SerpApi) para o itinerario do Frank (issue #27). Tudo que vem da
 * fonte passa pelo `itinerarioSchema`: opcao fora do formato fica de fora, nunca chega meio torta.
 */

export const NOME_FONTE_GOOGLE = 'google';

/** "2027-02-07 21:40" -> "2027-02-07T21:40". */
function horario(t: string): string {
  return t.trim().replace(' ', 'T');
}

const CODIGO_VOO = /^([A-Z0-9]{2,3})\s*(\d{1,5}[A-Z]?)$/;

/**
 * Filtros da busca no formato do Google. `stops`: 0 qualquer, 1 so direto, 2 ate 1 escala,
 * 3 ate 2 escalas.
 */
export function filtrosDaBusca(c: ConsultaVoo): Record<string, string> {
  const f: Record<string, string> = {};
  if (c.maxEscalas !== undefined) f.stops = String(Math.min(c.maxEscalas, 2) + 1);
  if (c.companhias?.length) f.include_airlines = c.companhias.join(',');
  else if (c.excluirCompanhias?.length) f.exclude_airlines = c.excluirCompanhias.join(',');
  return f;
}

export function opcoesDe(b: BuscaGoogle): OpcaoGoogle[] {
  return [...(b.best_flights ?? []), ...(b.other_flights ?? [])];
}

/**
 * "Nenhum voo" do Google vem como `error` com texto proprio: vira lista vazia. Qualquer outro erro
 * e falha de verdade (a fonte nunca esconde erro com []).
 */
export function semResultado(erro: string): Itinerario[] {
  if (/hasn't returned any results|no results/i.test(erro)) return [];
  throw new FonteIndisponivelError(NOME_FONTE_GOOGLE, erro.slice(0, 120));
}

/**
 * O link de compra e a propria busca no Google Flights. So https do google.com/travel/flights:
 * `google.com/url?q=...` e redirecionador aberto.
 */
export function linkDaBusca(link: string | undefined): string | null {
  if (!link) return null;
  try {
    const u = new URL(link);
    const host = u.hostname === 'www.google.com' || u.hostname === 'google.com';
    return u.protocol === 'https:' && host && u.pathname.startsWith('/travel/flights')
      ? u.href
      : null;
  } catch {
    return null;
  }
}

/** Uma opcao do Google vira uma perna do Frank. Voo com codigo ilegivel: null (fica de fora). */
export function pernaDe(o: OpcaoGoogle): Perna | null {
  const trechos: Perna['trechos'] = [];
  for (const f of o.flights) {
    const m = CODIGO_VOO.exec(f.flight_number.trim().toUpperCase());
    const companhia = (f.airline ?? '').trim();
    if (!m?.[1] || !m[2] || !companhia) return null;
    trechos.push({
      de: f.departure_airport.id,
      para: f.arrival_airport.id,
      partida: horario(f.departure_airport.time),
      chegada: horario(f.arrival_airport.time),
      companhia,
      codigoCompanhia: m[1],
      numeroVoo: `${m[1]}${m[2]}`,
    });
  }
  const primeiro = trechos[0];
  const ultimo = trechos.at(-1);
  if (!primeiro || !ultimo) return null;
  return {
    de: primeiro.de,
    para: ultimo.para,
    partida: primeiro.partida,
    chegada: ultimo.chegada,
    duracaoSegundos: Math.round(minutosDe(o, primeiro.partida, ultimo.chegada) * 60),
    escalas: trechos.length - 1,
    trechos,
  };
}

/** A duracao do Google; sem ela, voos + conexoes; sem nada, o relogio local (aproximado). */
function minutosDe(o: OpcaoGoogle, partida: string, chegada: string): number {
  if (o.total_duration !== undefined) return o.total_duration;
  const conexoes = o.layovers ?? [];
  if (
    o.flights.every((f) => f.duration !== undefined) &&
    conexoes.every((l) => l.duration !== undefined)
  ) {
    return (
      o.flights.reduce((s, f) => s + (f.duration ?? 0), 0) +
      conexoes.reduce((s, l) => s + (l.duration ?? 0), 0)
    );
  }
  return Math.max(
    0,
    Math.round((Date.parse(`${chegada}:00Z`) - Date.parse(`${partida}:00Z`)) / 60_000),
  );
}

/** Identidade estavel do voo: numeros de voo e dias. A mesma ida e volta tem o mesmo id. */
function idDe(ida: Perna, volta: Perna | null): string {
  const p = (x: Perna) =>
    x.trechos.map((t) => `${t.numeroVoo}@${t.partida.slice(0, 10)}`).join('+');
  return volta ? `${p(ida)}|${p(volta)}` : p(ida);
}

/**
 * Monta o itinerario. Ida e volta: o preco e o da opcao de volta (o Google ja mostra o total da
 * viagem ali). Sem preco, sem link ou fora do formato: lista vazia.
 */
export function itinerarioDoGoogle(
  opcaoIda: OpcaoGoogle,
  opcaoVolta: OpcaoGoogle | null,
  moeda: string,
  link: string | null,
): Itinerario[] {
  const preco = (opcaoVolta ?? opcaoIda).price;
  const ida = pernaDe(opcaoIda);
  const volta = opcaoVolta ? pernaDe(opcaoVolta) : null;
  if (preco === undefined || !ida || !link || (opcaoVolta && !volta)) return [];
  const r = itinerarioSchema.safeParse({
    fonte: NOME_FONTE_GOOGLE,
    idNaFonte: idDe(ida, volta),
    precoCentavos: reaisParaCentavos(preco),
    moeda,
    linkCompra: link,
    // A busca do Google nao diz a bagagem: o preco e o da tarifa, sem mala despachada.
    malas: { item: 1, mao: 0, despachada: 0 },
    ida,
    volta,
  });
  return r.success ? [r.data] : [];
}
