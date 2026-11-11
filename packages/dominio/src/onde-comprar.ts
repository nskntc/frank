import type { Centavos } from './dinheiro.js';
import { calcularPrecoFinal } from './preco-final.js';

/** A viagem da oferta, para montar o link de busca preenchida em cada site. */
export interface ViagemParaLink {
  origem: string;
  destino: string;
  /** AAAA-MM-DD */
  ida: string;
  /** AAAA-MM-DD; null = so ida. */
  volta: string | null;
  adultos: number;
}

const IATA = /^[A-Z]{3}$/;
const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

function partes(dia: string): [string, string, string] | null {
  const m = DIA.exec(dia);
  return m ? [m[1] as string, m[2] as string, m[3] as string] : null;
}

/**
 * Link que abre a mesma busca (rota, datas, adultos) no site do vendedor. Formatos testados por
 * uma pessoa no navegador em 2026-11-11 (issue #1), so ida e volta: so ida devolve null (usa o
 * link do Google). Vendedor sem formato conhecido: null.
 */
export function linkDeBusca(vendedor: string, v: ViagemParaLink): string | null {
  if (!v.volta || !IATA.test(v.origem) || !IATA.test(v.destino)) return null;
  if (!Number.isInteger(v.adultos) || v.adultos < 1 || v.adultos > 9) return null;
  const ida = partes(v.ida);
  const volta = partes(v.volta);
  if (!ida || !volta) return null;
  const [ai, mi, di] = ida;
  const [av, mv, dv] = volta;
  const { origem: o, destino: d, adultos: a } = v;

  switch (vendedor.trim().toLowerCase()) {
    case 'decolar':
      return `https://www.decolar.com/shop/flights/results/roundtrip/${o}/${d}/${v.ida}/${v.volta}/${a}/0/0`;
    case 'latam':
    case 'latam airlines':
      return (
        `https://www.latamairlines.com/br/pt/oferta-voos?origin=${o}&destination=${d}` +
        `&outbound=${v.ida}T12%3A00%3A00.000Z&inbound=${v.volta}T12%3A00%3A00.000Z` +
        `&adt=${a}&chd=0&inf=0&trip=RT&cabin=Economy&redemption=false&sort=RECOMMENDED`
      );
    case 'gol':
      return (
        `https://b2c.voegol.com.br/compra/busca-parceiros?pv=br&tipo=RT&de=${o}&para=${d}` +
        `&ida=${di}-${mi}-${ai}&volta=${dv}-${mv}-${av}&ADT=${a}&CHD=0&INF=0`
      );
    case 'azul':
      return (
        `https://www.voeazul.com.br/br/pt/home/selecao-voo?c[0].ds=${o}&c[0].std=${mi}/${di}/${ai}` +
        `&c[0].as=${d}&c[1].ds=${d}&c[1].std=${mv}/${dv}/${av}&c[1].as=${o}` +
        `&p[0].t=ADT&p[0].c=${a}&p[0].cp=false&f.dl=3&f.dr=3&cc=BRL`
      );
    default:
      return null;
  }
}

export type EtiquetaCompra = '24h_para_desistir' | 'empresa_estrangeira';

export interface OpcaoParaComprar {
  vendedor: string;
  /** Preco do vendedor, sem IOF. */
  precoCentavos: Centavos;
  estrangeiro: boolean;
  ehCompanhia: boolean;
  /** Link gravado (da fonte ou do Google). */
  link: string | null;
}

export interface ItemOndeComprar extends OpcaoParaComprar {
  /** O que a pessoa paga: com IOF quando o vendedor e estrangeiro. */
  precoFinalCentavos: Centavos;
  etiquetas: EtiquetaCompra[];
}

export interface OndeComprar {
  /** Do menor preco final ao maior; empate: a companhia primeiro. */
  itens: ItemOndeComprar[];
  /** Indice do item destacado em `itens` (-1 sem itens). */
  destacado: number;
  motivo: 'mais_barato' | 'companhia_na_tolerancia' | null;
}

export interface ContextoOndeComprar {
  /** Para o link de busca preenchida. Null: so os links gravados. */
  viagem: ViagemParaLink | null;
  /** "Pago ate X% a mais para comprar direto na companhia" (RF-14). */
  toleranciaPct: number;
  /** As 24 h da ANAC valem para esta compra (desistencia24h no dia de hoje). */
  vale24h: boolean;
}

/**
 * Monta a lista "Onde comprar" (SPEC-01 RF-12 a RF-14): preco final de cada vendedor, etiquetas,
 * link (busca preenchida no site do vendedor quando ha formato; senao o gravado) e o destaque.
 * Destaque: o mais barato; mas se a companhia custa ate `toleranciaPct`% a mais, ela.
 */
export function montarOndeComprar(opcoes: readonly OpcaoParaComprar[], ctx: ContextoOndeComprar): OndeComprar {
  const itens: ItemOndeComprar[] = opcoes.map((o) => {
    const etiquetas: EtiquetaCompra[] = [];
    if (o.ehCompanhia && ctx.vale24h) etiquetas.push('24h_para_desistir');
    if (o.estrangeiro) etiquetas.push('empresa_estrangeira');
    return {
      ...o,
      link: (ctx.viagem && linkDeBusca(o.vendedor, ctx.viagem)) ?? o.link,
      precoFinalCentavos: calcularPrecoFinal({ precoCentavos: o.precoCentavos, vendedorEstrangeiro: o.estrangeiro })
        .totalCentavos,
      etiquetas,
    };
  });
  itens.sort((a, b) => a.precoFinalCentavos - b.precoFinalCentavos || Number(b.ehCompanhia) - Number(a.ehCompanhia));

  const maisBarato = itens[0];
  if (!maisBarato) return { itens, destacado: -1, motivo: null };
  const companhia = itens.findIndex((i) => i.ehCompanhia);
  const alvo = itens[companhia];
  if (
    companhia > 0 &&
    alvo &&
    // Em inteiros: preco da companhia ate (100 + X)% do mais barato.
    alvo.precoFinalCentavos * 100 <= maisBarato.precoFinalCentavos * (100 + ctx.toleranciaPct)
  ) {
    return { itens, destacado: companhia, motivo: 'companhia_na_tolerancia' };
  }
  return { itens, destacado: 0, motivo: 'mais_barato' };
}
