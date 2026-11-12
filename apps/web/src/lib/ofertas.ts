import { detectarPegadinhas } from '@frank/agente';
import {
  type Banco,
  listarOfertas,
  obterPrecoVisto,
  obterVigilancia,
  ondeComprarDaOferta,
  type Oferta,
} from '@frank/banco';
import type { Itinerario, TipoPegadinha } from '@frank/contratos';
import type { Centavos, EtiquetaCompra } from '@frank/dominio';

/** Uma linha do "Onde comprar" pronta para a tela: link so https, ou nenhum. */
export interface CompraNaTela {
  vendedor: string;
  precoFinalCentavos: Centavos;
  ehCompanhia: boolean;
  etiquetas: EtiquetaCompra[];
  link: string | null;
}

export interface OfertaNaTela {
  id: number;
  descricao: string;
  adultos: number;
  itinerario: Itinerario;
  /** O que a pessoa paga no vendedor destacado (ou na fonte, sem "Onde comprar"). */
  precoCentavos: Centavos;
  percentualAbaixo: number | null;
  precoNormalCentavos: Centavos | null;
  /** Null: o Claude nao avaliou (indisponivel ou fora do formato). */
  valeAPena: boolean | null;
  resumo: string | null;
  pegadinhas: { tipo: TipoPegadinha; descricao: string }[];
  compras: CompraNaTela[];
  destacado: number;
  companhiaNaTolerancia: boolean;
  vistoEm: string;
}

/**
 * Links que o painel aceita abrir: so https. Os links ja chegam validados da fonte e do
 * "Onde comprar"; isto e a ultima barreira contra `javascript:` num botao de compra.
 */
export function linkSeguro(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    return new URL(link).protocol === 'https:' ? link : null;
  } catch {
    return null;
  }
}

/** Nome de vitrine das fontes e se vendem como empresa estrangeira (IOF ja no preco da oferta). */
export const FONTES: Record<string, { nome: string; estrangeira: boolean }> = {
  kiwi: { nome: 'Kiwi.com', estrangeira: true },
};

function paraTela(db: Banco, oferta: Oferta, hoje: Date): OfertaNaTela | null {
  const visto = obterPrecoVisto(db, oferta.precoVistoId);
  const vigilancia = obterVigilancia(db, oferta.vigilanciaId);
  // Itinerario gravado num formato antigo ou vigilancia apagada: nada confiavel para mostrar.
  if (!visto?.itinerario || !vigilancia) return null;
  const it = visto.itinerario;

  const onde = ondeComprarDaOferta(db, oferta.id, hoje);
  const compras: CompraNaTela[] = (onde?.itens ?? []).map((i) => ({
    vendedor: i.vendedor,
    precoFinalCentavos: i.precoFinalCentavos,
    ehCompanhia: i.ehCompanhia,
    etiquetas: i.etiquetas,
    link: linkSeguro(i.link),
  }));
  let destacado = onde && onde.destacado >= 0 ? onde.destacado : -1;
  if (compras.length === 0) {
    // Sem "Onde comprar" gravado: o link da propria fonte, ao preco da oferta.
    const fonte = FONTES[it.fonte];
    compras.push({
      vendedor: fonte?.nome ?? it.fonte,
      precoFinalCentavos: oferta.precoFinalCentavos,
      ehCompanhia: false,
      etiquetas: fonte?.estrangeira ? ['empresa_estrangeira'] : [],
      link: linkSeguro(it.linkCompra),
    });
    destacado = 0;
  }

  // Sem avaliacao do Claude, as pegadinhas objetivas do codigo continuam valendo.
  const pegadinhas =
    oferta.avaliacao?.pegadinhas ??
    detectarPegadinhas({
      itinerario: it,
      vigilancia,
      vendedorEstrangeiro: false, // a etiqueta "empresa estrangeira" ja aparece no Onde comprar
      percentualAbaixo: oferta.percentualAbaixo,
    });

  return {
    id: oferta.id,
    descricao: vigilancia.descricao,
    adultos: vigilancia.adultos,
    itinerario: it,
    precoCentavos: compras[destacado]?.precoFinalCentavos ?? oferta.precoFinalCentavos,
    percentualAbaixo: oferta.percentualAbaixo,
    precoNormalCentavos: oferta.precoNormalCentavos,
    valeAPena: oferta.avaliacao?.valeAPena ?? null,
    resumo: oferta.avaliacao?.resumo ?? null,
    pegadinhas,
    compras,
    destacado,
    companhiaNaTolerancia: onde?.motivo === 'companhia_na_tolerancia',
    vistoEm: oferta.reconferidaEm ?? visto.vistoEm,
  };
}

/** Ofertas da tela inicial (RF-18), da mais barata para a mais cara, sem as descartadas. */
export function ofertasParaTela(db: Banco, hoje: Date = new Date()): OfertaNaTela[] {
  return listarOfertas(db).flatMap((o) => paraTela(db, o, hoje) ?? []);
}
