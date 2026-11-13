import { descreverFiltros, falhouInteira, type Vigilancia } from '@frank/contratos';
import { haQuanto } from './formatar';

/**
 * Situacao da rota para o painel (issues #4 e #22). Separa o que a pessoa precisa distinguir:
 * nunca rodou, rodou e falhou, rodou e a fonte nao achou nenhum voo, e rodou bem.
 */
export type Situacao =
  | { tipo: 'pausada' }
  | { tipo: 'nunca_rodou' }
  | { tipo: 'falhou'; quando: string; erro: string | null; tentaLogo: boolean }
  | {
      tipo: 'sem_voos';
      quando: string;
      nuncaAchou: boolean;
      /** Voos que a fonte trouxe e os filtros de horario e duracao tiraram (issue #21). */
      foraDosFiltros: number;
      sugestoes: Sugestao[];
    }
  | { tipo: 'ok'; quando: string; voos: number; erros: number; erro: string | null };

export interface Sugestao {
  /** O que mudar e o custo disso, em uma frase. */
  texto: string;
  /** O que acrescentar ao pedido, ao clicar em Editar. */
  noPedido: string;
}

/**
 * Aeroportos maiores perto, para quem sai de um aeroporto regional. Lista curta e fixa (nao
 * chama fonte nenhuma): a ideia e lembrar a pessoa de que o hub costuma ter voo em passagem unica.
 */
const HUB_POR_REGIAO: Record<string, readonly string[]> = {
  centroOeste: ['BSB', 'GRU'],
  norte: ['BSB', 'GRU'],
  nordeste: ['REC', 'FOR', 'GRU'],
  sudeste: ['GRU', 'GIG'],
  minas: ['CNF', 'GRU'],
  sul: ['GRU', 'POA'],
};
const REGIAO: Record<string, keyof typeof HUB_POR_REGIAO> = {
  GYN: 'centroOeste',
  CGB: 'centroOeste',
  CGR: 'centroOeste',
  RVD: 'centroOeste',
  CLV: 'centroOeste',
  MAO: 'norte',
  BEL: 'norte',
  PVH: 'norte',
  RBR: 'norte',
  BVB: 'norte',
  MCP: 'norte',
  PMW: 'norte',
  STM: 'norte',
  MAB: 'norte',
  THE: 'nordeste',
  SLZ: 'nordeste',
  JPA: 'nordeste',
  NAT: 'nordeste',
  MCZ: 'nordeste',
  AJU: 'nordeste',
  IOS: 'nordeste',
  BPS: 'nordeste',
  JDO: 'nordeste',
  PNZ: 'nordeste',
  FEN: 'nordeste',
  CPV: 'nordeste',
  VIX: 'sudeste',
  RAO: 'sudeste',
  SJP: 'sudeste',
  SDU: 'sudeste',
  CGH: 'sudeste',
  CAW: 'sudeste',
  UDI: 'minas',
  MOC: 'minas',
  IPN: 'minas',
  PLU: 'minas',
  JDF: 'minas',
  GVR: 'minas',
  FLN: 'sul',
  NVT: 'sul',
  JOI: 'sul',
  LDB: 'sul',
  MGF: 'sul',
  IGU: 'sul',
  CXJ: 'sul',
  XAP: 'sul',
  CWB: 'sul',
};

/**
 * O que a pessoa pode mudar para a fonte achar voo, a partir da propria vigilancia. Na ordem do
 * que mais costuma resolver.
 */
export function sugestoesSemVoos(v: Vigilancia, foraDosFiltros = 0): Sugestao[] {
  const s: Sugestao[] = [];
  const filtros = descreverFiltros(v.filtros);
  if (foraDosFiltros > 0 && filtros) {
    s.push({
      texto: `Afrouxar os filtros de horário e duração (hoje: ${filtros}). É o que está tirando os voos.`,
      noPedido: 'com qualquer horário e duração',
    });
  }
  if (!v.aceitarPassagensSeparadas) {
    s.push({
      texto:
        'Aceitar passagens separadas: aparecem mais combinações, mas se um voo atrasar ninguém te realoca no seguinte.',
      noPedido: 'pode ser com passagens separadas',
    });
  }
  const hubs = [...new Set(v.origens.flatMap((o) => HUB_POR_REGIAO[REGIAO[o] ?? ''] ?? []))].filter(
    (h) => !v.origens.includes(h),
  );
  if (hubs.length > 0) {
    const lista = hubs.slice(0, 2).join(' ou ');
    s.push({
      texto: `Incluir um aeroporto maior perto, como ${lista}: costuma ter voo em passagem única, e você chega até ele por conta própria.`,
      noPedido: `saindo também de ${lista}`,
    });
  }
  if (v.maxEscalas !== null && v.maxEscalas < 3) {
    s.push({
      texto: `Aceitar mais escalas (hoje: até ${v.maxEscalas}).`,
      noPedido: 'com qualquer número de escalas',
    });
  }
  if (v.companhias.length > 0) {
    s.push({
      texto: `Liberar outras companhias (hoje: só ${v.companhias.join(', ')}).`,
      noPedido: 'qualquer companhia',
    });
  }
  const idaFixa = v.idaDe === v.idaAte;
  const voltaFixa = v.voltaDe !== null && v.voltaDe === v.voltaAte;
  if (idaFixa || voltaFixa) {
    s.push({
      texto: 'Deixar as datas flexíveis: alguns dias a mais de janela abrem outros voos.',
      noPedido: 'com datas flexíveis, dois dias antes ou depois',
    });
  }
  return s;
}

export function situacaoDaRota(v: Vigilancia, jaAchouVoo: boolean): Situacao {
  if (!v.ativa) return { tipo: 'pausada' };
  if (!v.ultimaRodadaEm) return { tipo: 'nunca_rodou' };
  const quando = haQuanto(v.ultimaRodadaEm);
  const r = v.ultimaRodadaResultado;
  if (!r) return { tipo: 'ok', quando, voos: 0, erros: 0, erro: null };
  if (r.itinerarios === 0 && (r.erros > 0 || r.puladasPorTeto > 0)) {
    return {
      tipo: 'falhou',
      quando,
      erro: r.ultimoErro,
      tentaLogo: falhouInteira(r) && !r.repeticao,
    };
  }
  if (r.itinerarios === 0 && r.consultas > 0) {
    const fora = r.foraDosFiltros ?? 0;
    return {
      tipo: 'sem_voos',
      quando,
      nuncaAchou: !jaAchouVoo,
      foraDosFiltros: fora,
      sugestoes: sugestoesSemVoos(v, fora),
    };
  }
  return { tipo: 'ok', quando, voos: r.itinerarios, erros: r.erros, erro: r.ultimoErro };
}
