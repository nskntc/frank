import { gravarEstado, lerEstado, listarVigilancias, registrarPrecosVistos } from '@frank/banco';
import {
  cabeNaEstadia,
  checagemPendente,
  type ResultadoRodadaVigilancia,
  type Vigilancia,
} from '@frank/contratos';
import { lerDia } from '@frank/dominio';
import { type ConsultaVoo, FonteGoogle, type FontePreco } from '@frank/fontes';
import { type ContextoFonte, conferirMoeda, resumirErro } from './apoio-fonte.js';
import { BUSCAS_GOOGLE_POR_DIA_PADRAO } from './google.js';

/**
 * O Google Flights como segunda fonte de voos (issue #27). A cota da SerpApi e pequena (250 por
 * mes no plano gratis), entao a busca e racionada: uma por rota de tempos em tempos, um dia de ida
 * (e um de volta) por vez, girando pela janela de datas. Rota em que a Kiwi nao achou nada busca
 * com o dobro da frequencia. "Checar agora" e viagem editada buscam ja, se a cota deixar.
 */
export interface ContextoBuscaGoogle extends ContextoFonte {
  google?: FontePreco;
  /** Consultas da SerpApi em 24 h para a busca de voos. Usado para espacar as rotas. */
  buscasGooglePorDia?: number;
}

const chave = (id: string) => `google:${id}`;
const DIA_MS = 86_400_000;

/** O Google nao informa o preco com mala despachada: essas rotas ficam so com a Kiwi. */
export function rotaVaiAoGoogle(v: Vigilancia): boolean {
  return v.malasDespachadas === 0;
}

function custo(v: Vigilancia): number {
  return FonteGoogle.custo({ volta: v.voltaDe ? lerDia(v.voltaDe) : undefined });
}

/**
 * De quanto em quanto tempo cada rota vai ao Google, para todas juntas caberem na cota do dia.
 * Nunca menos que o intervalo da propria rota.
 */
export function intervaloGoogleMinutos(
  v: Vigilancia,
  ativas: readonly Vigilancia[],
  porDia: number,
): number {
  const total = ativas.filter(rotaVaiAoGoogle).reduce((s, x) => s + custo(x), 0);
  return Math.max(v.intervaloMinutos, Math.ceil((24 * 60 * Math.max(total, 1)) / porDia));
}

function somarDias(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
}

function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA_MS);
}

/**
 * Os dias da `k`-esima busca no Google: a ida gira pela janela; a volta fica a uma distancia fixa
 * (o meio da estadia pedida, ou a distancia entre o comeco das janelas), dentro da janela de volta.
 */
export function diasDaBusca(v: Vigilancia, k: number): { ida: string; volta: string | null } {
  const n = diasEntre(v.idaDe, v.idaAte) + 1;
  const ida = somarDias(v.idaDe, ((k % n) + n) % n);
  if (!v.voltaDe || !v.voltaAte) return { ida, volta: null };
  const distancia = v.estadia
    ? Math.round((v.estadia.minNoites + v.estadia.maxNoites) / 2)
    : Math.max(0, diasEntre(v.idaDe, v.voltaDe));
  let volta = somarDias(ida, distancia);
  if (volta < v.voltaDe) volta = v.voltaDe;
  if (volta > v.voltaAte) volta = v.voltaAte;
  if (volta < ida) volta = ida;
  return { ida, volta };
}

function consultaDoGoogle(v: Vigilancia, dias: { ida: string; volta: string | null }): ConsultaVoo {
  return {
    // O Google aceita varios aeroportos numa busca so: todos os pares de uma vez.
    origem: v.origens.join(','),
    destino: v.destinos.join(','),
    ida: lerDia(dias.ida),
    ...(dias.volta ? { volta: lerDia(dias.volta) } : {}),
    adultos: v.adultos,
    ...(v.maxEscalas !== null ? { maxEscalas: v.maxEscalas } : {}),
    ...(v.companhias.length ? { companhias: v.companhias } : {}),
    moeda: v.moeda,
  };
}

interface EstadoGoogle {
  /** Indice da proxima busca na janela de datas. */
  proximo: number;
}

function lerProximo(valor: string): number {
  try {
    const n = (JSON.parse(valor) as Partial<EstadoGoogle>).proximo;
    return Number.isInteger(n) && (n as number) >= 0 ? (n as number) : 0;
  } catch {
    return 0;
  }
}

/**
 * Busca a vigilancia no Google, se e a vez dela, e grava os voos na mesma rodada da Kiwi. Falha do
 * Google so vai para o log: nao conta como erro da rodada (a Kiwi e o radar; o Google, reforco).
 */
export async function buscarNoGoogle(
  ctx: ContextoBuscaGoogle,
  v: Vigilancia,
  rodada: string,
  agora: Date,
  resultado: ResultadoRodadaVigilancia,
): Promise<void> {
  const google = ctx.google;
  if (!google || !rotaVaiAoGoogle(v)) return;

  const estado = lerEstado(ctx.db, chave(v.id));
  // Viagem mudou depois da ultima busca: recomeca a janela do primeiro dia.
  const daViagemAtual = estado !== null && estado.atualizadoEm >= v.historicoDesde;
  const k = daViagemAtual ? lerProximo(estado.valor) : 0;
  if (daViagemAtual && !checagemPendente(v)) {
    const porDia = ctx.buscasGooglePorDia ?? BUSCAS_GOOGLE_POR_DIA_PADRAO;
    const ativas = listarVigilancias(ctx.db, { soAtivas: true });
    const cheio = intervaloGoogleMinutos(v, ativas, porDia);
    const intervalo = resultado.itinerarios === 0 ? Math.max(v.intervaloMinutos, cheio / 2) : cheio;
    if (agora.getTime() - Date.parse(estado.atualizadoEm) < intervalo * 60_000) return;
  }

  const dias = diasDaBusca(v, k);
  const rotulo = `google ${v.origens.join(',')}→${v.destinos.join(',')} ${dias.ida}${dias.volta ? `/${dias.volta}` : ''}`;
  let voos;
  try {
    voos = await google.buscar(consultaDoGoogle(v, dias));
  } catch (erro) {
    // Sem cota nao marca a busca: tenta de novo quando sobrar. Outro erro marca (nao martela).
    const msg = resumirErro(erro);
    if (!/cota/.test(msg))
      gravarEstado(ctx.db, chave(v.id), JSON.stringify({ proximo: k + 1 }), agora);
    ctx.log.aviso(`${rotulo}: ${msg}`);
    return;
  }
  gravarEstado(ctx.db, chave(v.id), JSON.stringify({ proximo: k + 1 }), agora);

  const moedaErrada = conferirMoeda(voos, v.moeda);
  if (moedaErrada) {
    ctx.log.aviso(`${rotulo}: ${moedaErrada}`);
    return;
  }
  const servem = voos.filter((it) => cabeNaEstadia(it, v.estadia));
  try {
    if (servem.length > 0) registrarPrecosVistos(ctx.db, v.id, rodada, servem, agora);
    resultado.itinerarios += servem.length;
    ctx.log.info(`${rotulo}: ${servem.length} voo(s)`);
  } catch (erro) {
    ctx.log.erro(`não consegui gravar os preços de ${rotulo}: ${resumirErro(erro)}`);
  }
}
