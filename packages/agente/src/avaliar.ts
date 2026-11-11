import {
  type AvaliacaoOferta,
  avaliacaoOfertaSchema,
  type Itinerario,
  type Perna,
  type Vigilancia,
} from '@frank/contratos';
import { type Centavos, formatarReais } from '@frank/dominio';
import type { ProvedorLLM } from '@frank/ia';
import { z } from 'zod';
import { detectarPegadinhas, type Pegadinha } from './pegadinhas.js';
import { montarSistema } from './skills.js';
import { neutralizarTexto, temPrecoOuLink } from './texto.js';

/** O que o Claude devolve. Os tipos de pegadinha sao do Frank; o Claude so acrescenta "outra". */
export const respostaAvaliacaoSchema = z
  .object({
    valeAPena: z.boolean(),
    pegadinhasExtras: z.array(z.object({ descricao: z.string().max(200) }).strict()).max(3),
    resumo: z.string().max(300),
  })
  .strict();

export interface EntradaAvaliacao {
  vigilancia: Vigilancia;
  itinerario: Itinerario;
  precoFonteCentavos: Centavos;
  /** Com IOF quando o vendedor e estrangeiro. */
  precoFinalCentavos: Centavos;
  precoNormalCentavos: Centavos | null;
  percentualAbaixo: number | null;
  vendedorEstrangeiro: boolean;
}

function descreverPerna(p: Perna) {
  return {
    de: p.de,
    para: p.para,
    partida: p.partida,
    chegada: p.chegada,
    escalas: p.escalas,
    trechos: p.trechos.map((t) => ({
      de: t.de,
      para: t.para,
      partida: t.partida,
      chegada: t.chegada,
      companhia: t.companhia,
    })),
  };
}

/** Os dados da oferta, sem link nem id da fonte (o Claude nao precisa e nao deve repassar). */
function montarDados(e: EntradaAvaliacao, pegadinhas: Pegadinha[]) {
  const v = e.vigilancia;
  return {
    viagemPedida: {
      origens: v.origens,
      destinos: v.destinos,
      ida: [v.idaDe, v.idaAte],
      volta: v.voltaDe ? [v.voltaDe, v.voltaAte] : null,
      adultos: v.adultos,
      malasDespachadasPorAdulto: v.malasDespachadas,
      precoAlvo: v.precoAlvoCentavos !== null ? formatarReais(v.precoAlvoCentavos) : null,
    },
    vooEncontrado: {
      ida: descreverPerna(e.itinerario.ida),
      volta: e.itinerario.volta ? descreverPerna(e.itinerario.volta) : null,
      malasIncluidas: e.itinerario.malas,
    },
    numeros: {
      precoNaFonte: formatarReais(e.precoFonteCentavos),
      precoFinal: formatarReais(e.precoFinalCentavos),
      precoNormalDaRota: e.precoNormalCentavos !== null ? formatarReais(e.precoNormalCentavos) : 'ainda sem histórico',
      percentualAbaixoDoNormal: e.percentualAbaixo,
      vendedorEstrangeiro: e.vendedorEstrangeiro,
    },
    pegadinhasDetectadasPeloFrank: pegadinhas.map((p) => p.descricao),
  };
}

function resumoDoCodigo(valeAPena: boolean, pegadinhas: Pegadinha[]): string {
  const base = valeAPena ? 'Vale a pena pelo preço.' : 'Não parece valer a pena.';
  const cuidado = pegadinhas.at(0);
  return cuidado ? `${base} Atenção: ${cuidado.descricao}` : base;
}

/**
 * O Claude avalia se a oferta vale a pena (SPEC-01 RF-10). As pegadinhas objetivas sao do
 * codigo; o Claude julga e resume. O resumo nunca carrega preco nem link (se vier, e trocado pelo
 * resumo do codigo). Devolve a avaliacao no formato do contrato, validada.
 */
export async function avaliarOferta(ia: ProvedorLLM, entrada: EntradaAvaliacao): Promise<AvaliacaoOferta> {
  const pegadinhas = detectarPegadinhas({
    itinerario: entrada.itinerario,
    vigilancia: entrada.vigilancia,
    vendedorEstrangeiro: entrada.vendedorEstrangeiro,
    percentualAbaixo: entrada.percentualAbaixo,
  });

  const { dados } = await ia.perguntar({
    tarefa: 'avaliar_oferta',
    sistema: montarSistema(['avaliar_oferta', 'regras_brasil']),
    mensagem: `<oferta>\n${neutralizarTexto(JSON.stringify(montarDados(entrada, pegadinhas), null, 1))}\n</oferta>`,
    schema: respostaAvaliacaoSchema,
  });

  const extras = dados.pegadinhasExtras
    .filter((p) => p.descricao.trim() && !temPrecoOuLink(p.descricao))
    .map((p) => ({ tipo: 'outra' as const, descricao: p.descricao.trim() }));
  const todas = [...pegadinhas, ...extras].slice(0, 10);
  const resumo =
    dados.resumo.trim() && !temPrecoOuLink(dados.resumo) ? dados.resumo.trim() : resumoDoCodigo(dados.valeAPena, todas);

  return avaliacaoOfertaSchema.parse({ valeAPena: dados.valeAPena, pegadinhas: todas, resumo });
}
