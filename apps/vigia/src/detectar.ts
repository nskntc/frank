import { avaliarOferta, type EntradaAvaliacao } from '@frank/agente';
import {
  marcarReconferida,
  menorOfertaAberta,
  menoresPorRodada,
  obterOferta,
  type Oferta,
  precosDaRodada,
  registrarOferta,
  registrarPrecosVistos,
  salvarAvaliacao,
} from '@frank/banco';
import type { ProvedorLLM } from '@frank/ia';
import type { Itinerario, ResultadoRodadaVigilancia, Vigilancia } from '@frank/contratos';
import {
  type Centavos,
  calcularPrecoFinal,
  DETECTOR_PADRAO,
  detectarOferta,
  formatarReais,
  precoNormal,
  type ResultadoDetector,
} from '@frank/dominio';
import type { ConsultaVoo, FontePreco } from '@frank/fontes';
import {
  conferirMoeda,
  podeConsultar,
  registrarConsultaSemLancar,
  resumirErro,
} from './apoio-fonte.js';
import { companhiasDoResultado, consultasDaVigilancia } from './consultas.js';
import { type ContextoGoogle, gravarOndeComprar, normalPelaReferencia } from './google.js';

/** Janela do preco normal (SPEC-01 RF-07, calibrar). */
export const JANELA_NORMAL_DIAS = 14;

export interface ContextoDeteccao extends ContextoGoogle {
  fontes: readonly FontePreco[];
  /** O Claude, ja com orcamento. Sem ele, toda oferta fica "sem avaliacao" (RF-11). */
  ia?: ProvedorLLM;
}

/**
 * Pede a avaliacao ao Claude e grava. Claude ausente, indisponivel ou com resposta invalida:
 * "sem avaliacao", e a rodada segue (RF-11). O motivo ja fica gravado pelo ComOrcamento.
 */
async function avaliarEGravar(
  ctx: ContextoDeteccao,
  oferta: Oferta,
  entrada: EntradaAvaliacao,
  rotulo: string,
): Promise<void> {
  if (!ctx.ia) {
    salvarAvaliacao(ctx.db, oferta.id, null);
    return;
  }
  try {
    salvarAvaliacao(ctx.db, oferta.id, await avaliarOferta(ctx.ia, entrada));
  } catch (erro) {
    salvarAvaliacao(ctx.db, oferta.id, null);
    ctx.log.aviso(`oferta de ${rotulo} ficou sem avaliação: ${resumirErro(erro)}`);
  }
}

interface Avaliacao {
  precoFinal: Centavos;
  deteccao: ResultadoDetector;
}

function avaliar(
  precoFonte: Centavos,
  fonte: FontePreco,
  vigilancia: Vigilancia,
  normal: Centavos | null,
): Avaliacao {
  const { totalCentavos } = calcularPrecoFinal({
    precoCentavos: precoFonte,
    vendedorEstrangeiro: fonte.vendedorEstrangeiro ?? false,
  });
  return {
    precoFinal: totalCentavos,
    deteccao: detectarOferta({
      precoFinal: totalCentavos,
      precoParaNormal: precoFonte,
      precoAlvo: vigilancia.precoAlvoCentavos,
      precoNormal: normal,
    }),
  };
}

/**
 * Depois de uma rodada: o voo mais barato dela vira oferta? (SPEC-01 RF-07 a RF-09)
 * 1. Preco normal = mediana do menor preco de cada rodada dos ultimos 14 dias, SEM esta rodada.
 * 2. Regra: o preco final (com IOF de vendedor estrangeiro) ate o alvo, ou o preco da fonte
 *    25% abaixo do normal.
 * 3. Nao repete: se o mesmo itinerario ja tem oferta aberta pelo mesmo preco ou menos, para aqui.
 * 4. Reconfere na fonte, buscando so as companhias daquele voo. Sumiu ou subiu: nao e oferta.
 * Devolve a oferta criada, ou null.
 */
export async function detectarNaRodada(
  ctx: ContextoDeteccao,
  vigilancia: Vigilancia,
  rodada: string,
  agora: Date,
  resultado: ResultadoRodadaVigilancia,
): Promise<Oferta | null> {
  const candidato = precosDaRodada(ctx.db, vigilancia.id, rodada).find(
    (p) => p.moeda === vigilancia.moeda && p.itinerario !== null,
  );
  const itinerario = candidato?.itinerario;
  if (!candidato || !itinerario) return null;
  const fonte = ctx.fontes.find((f) => f.nome === candidato.fonte);
  if (!fonte) return null;

  const bases = consultasDaVigilancia(vigilancia);
  const desde = new Date(agora.getTime() - JANELA_NORMAL_DIAS * 86_400_000);
  const proprio = precoNormal(
    menoresPorRodada(ctx.db, vigilancia.id, desde, vigilancia.moeda, rodada),
    DETECTOR_PADRAO.minimoObservacoes,
  );
  // Sem historico proprio suficiente, vale a referencia do Google (RF-07), se houver.
  const normal = proprio ?? (bases[0] ? await normalPelaReferencia(ctx, vigilancia, bases[0], agora) : null);

  const primeira = avaliar(candidato.precoCentavos, fonte, vigilancia, normal);
  if (!primeira.deteccao.ehOferta) return null;

  const aberta = menorOfertaAberta(ctx.db, vigilancia.id, fonte.nome, candidato.idNaFonte, vigilancia.moeda);
  if (aberta !== null && primeira.precoFinal >= aberta) return null;

  const rotulo = `"${vigilancia.descricao}" ${itinerario.ida.de}→${itinerario.ida.para}`;
  const base = bases.find((b) => b.origem === itinerario.ida.de && b.destino === itinerario.ida.para);
  if (!base) {
    // Nunca reconferir com a busca de outro par: o voo "sumiria" e a oferta seria perdida calada.
    ctx.log.aviso(`reconferência de ${rotulo} não feita: nenhuma busca da vigilância para esse par`);
    return null;
  }
  const reconferido = await reconferir(ctx, fonte, vigilancia, base, itinerario, candidato.idNaFonte, rotulo, agora, resultado);
  if (!reconferido) return null;

  // O voo reconferido entra na mesma rodada (fica duas vezes nela; a mediana nao muda porque
  // conta so o menor preco da rodada). O painel mostra cada itinerario uma vez.
  const precoVistoId = registrarPrecosVistos(ctx.db, vigilancia.id, rodada, [reconferido], agora)[0] as number;
  const segunda = avaliar(reconferido.precoCentavos, fonte, vigilancia, normal);
  if (!segunda.deteccao.ehOferta) {
    ctx.log.info(`oferta de ${rotulo} não se confirmou: o preço subiu para ${formatarReais(segunda.precoFinal)}`);
    return null;
  }
  // A checagem de repeticao vale para o preco reconferido, que e o que fica gravado.
  if (aberta !== null && segunda.precoFinal >= aberta) return null;

  // precoFinal tem IOF; precoNormal e percentualAbaixo sao na base da fonte (sem IOF). O preco
  // da fonte fica no preco visto (precoVistoId): o painel mostra o percentual "na fonte".
  const oferta = registrarOferta(
    ctx.db,
    {
      vigilanciaId: vigilancia.id,
      precoVistoId,
      precoFinalCentavos: segunda.precoFinal,
      moeda: vigilancia.moeda,
      precoNormalCentavos: normal,
      percentualAbaixo: segunda.deteccao.percentualAbaixo,
      motivos: segunda.deteccao.motivos,
    },
    agora,
  );
  marcarReconferida(ctx.db, oferta.id, agora);
  const p = oferta.percentualAbaixo;
  const abaixo = p === null ? '' : p >= 0 ? `, ${p}% abaixo do normal` : `, ${-p}% acima do normal`;
  ctx.log.info(`oferta: ${rotulo} por ${formatarReais(oferta.precoFinalCentavos)}${abaixo}`);

  try {
    await gravarOndeComprar(ctx, oferta.id, fonte, base, reconferido, agora);
  } catch (erro) {
    ctx.log.aviso(`onde comprar de ${rotulo} não foi gravado: ${resumirErro(erro)}`);
  }

  await avaliarEGravar(
    ctx,
    oferta,
    {
      vigilancia,
      itinerario: reconferido,
      precoFonteCentavos: reconferido.precoCentavos,
      precoFinalCentavos: oferta.precoFinalCentavos,
      precoNormalCentavos: normal,
      percentualAbaixo: oferta.percentualAbaixo,
      vendedorEstrangeiro: fonte.vendedorEstrangeiro ?? false,
    },
    rotulo,
  );
  return obterOferta(ctx.db, oferta.id) ?? oferta;
}

/** Busca de novo o mesmo voo. Devolve o itinerario reconferido, ou null (sumiu, erro, teto). */
async function reconferir(
  ctx: ContextoDeteccao,
  fonte: FontePreco,
  vigilancia: Vigilancia,
  base: ConsultaVoo,
  itinerario: Itinerario,
  idNaFonte: string,
  rotulo: string,
  agora: Date,
  resultado: ResultadoRodadaVigilancia,
): Promise<Itinerario | null> {
  if (!podeConsultar(ctx, fonte.nome, agora, resultado)) {
    ctx.log.aviso(`reconferência de ${rotulo} adiada: teto da ${fonte.nome}`);
    return null;
  }
  // So as companhias daquele voo: ele cabe nos 15 resultados da fonte.
  const consulta = { ...base, companhias: companhiasDoResultado([itinerario]), excluirCompanhias: undefined };

  resultado.consultas++;
  let itinerarios: Itinerario[];
  try {
    itinerarios = await fonte.buscar(consulta);
  } catch (erro) {
    resultado.erros++;
    resultado.ultimoErro = `reconferência ${fonte.nome} ${rotulo}: ${resumirErro(erro)}`;
    registrarConsultaSemLancar(ctx, fonte.nome, { sucesso: false, erro: resumirErro(erro) }, agora);
    ctx.log.aviso(resultado.ultimoErro);
    return null;
  }
  const moedaErrada = conferirMoeda(itinerarios, vigilancia.moeda);
  if (moedaErrada) {
    resultado.erros++;
    resultado.ultimoErro = `reconferência ${fonte.nome} ${rotulo}: ${moedaErrada}`;
    registrarConsultaSemLancar(ctx, fonte.nome, { sucesso: false, erro: moedaErrada }, agora);
    ctx.log.aviso(resultado.ultimoErro);
    return null;
  }
  registrarConsultaSemLancar(ctx, fonte.nome, { sucesso: true }, agora);

  const mesmo = itinerarios.find((it) => it.idNaFonte === idNaFonte) ?? null;
  if (!mesmo) ctx.log.info(`oferta de ${rotulo} não se confirmou: o voo sumiu na reconferência`);
  return mesmo;
}
