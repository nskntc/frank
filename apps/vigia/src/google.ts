import {
  apagarReferencias,
  contarConsultas,
  gravarEstado,
  lerEstado,
  listarReferencias,
  type OpcaoCompra,
  registrarConsulta,
  salvarOpcoesCompra,
  salvarReferencias,
} from '@frank/banco';
import type { Itinerario, Vigilancia } from '@frank/contratos';
import { type Centavos, DETECTOR_PADRAO, mediana } from '@frank/dominio';
import type { ConsultaVoo, FontePreco, SerpApiGoogleFlights } from '@frank/fontes';
import { type ContextoFonte, resumirErro } from './apoio-fonte.js';

/**
 * O Google Flights (via SerpApi) no vigia: historico da rota para o preco normal antes de o
 * Frank ter historico proprio (RF-07) e preco em cada vendedor quando ha oferta (RF-12).
 * Tudo opcional: sem chave, o vigia segue so com a Kiwi.
 */
/** O que o vigia usa do SerpApi (permite um Google falso nos testes). */
export type GoogleFlights = Pick<SerpApiGoogleFlights, 'historico' | 'opcoesDeCompra'>;

export interface ContextoGoogle extends ContextoFonte {
  serpapi?: GoogleFlights;
  /** Consultas ao SerpApi em 30 dias (plano gratis: 250; padrao 240 para sobrar margem). */
  tetoMensalSerpApi?: number;
}

export const TETO_MENSAL_SERPAPI_PADRAO = 240;
const DIA_MS = 86_400_000;
/** Referencia valida por 7 dias; depois de erro, tenta de novo no dia seguinte. */
const VALIDADE_REFERENCIA_MS = 7 * DIA_MS;
const ESPERA_APOS_ERRO_MS = DIA_MS;
/** Minimo de dias de historico do Google para valer como preco normal (calibrar). */
export const MINIMO_PONTOS_REFERENCIA = DETECTOR_PADRAO.minimoPontosReferencia;
const JANELA_REFERENCIA_DIAS = DETECTOR_PADRAO.janelaReferenciaDias;

const chaveReferencia = (vigilanciaId: string) => `referencia:${vigilanciaId}`;

/** Ainda cabem `n` consultas no teto mensal? */
function cabe(ctx: ContextoGoogle, n: number, agora: Date): boolean {
  const teto = ctx.tetoMensalSerpApi ?? TETO_MENSAL_SERPAPI_PADRAO;
  const usadas = contarConsultas(ctx.db, 'serpapi', new Date(agora.getTime() - 30 * DIA_MS));
  if (usadas + n <= teto) return true;
  ctx.log.aviso(`serpapi: teto de ${teto} consultas em 30 dias atingido`);
  return false;
}

function registrar(ctx: ContextoGoogle, n: number, agora: Date, erro?: string): void {
  for (let i = 0; i < n; i++) {
    try {
      registrarConsulta(ctx.db, 'serpapi', erro ? { sucesso: false, erro } : { sucesso: true }, agora);
    } catch (e) {
      ctx.log.erro(`não consegui registrar a consulta ao serpapi: ${resumirErro(e)}`);
    }
  }
}

/**
 * Preco normal pela referencia do Google: mediana do historico dos ultimos 60 dias, se houver
 * pelo menos 10 dias. Busca (1 consulta) quando nao ha referencia valida para a viagem atual.
 */
export async function normalPelaReferencia(
  ctx: ContextoGoogle,
  vigilancia: Vigilancia,
  base: ConsultaVoo,
  agora: Date,
): Promise<Centavos | null> {
  if (ctx.serpapi) await atualizarReferencia(ctx, vigilancia, base, agora);
  const desde = new Date(agora.getTime() - JANELA_REFERENCIA_DIAS * DIA_MS).toISOString().slice(0, 10);
  const precos = listarReferencias(ctx.db, vigilancia.id, vigilancia.moeda)
    .filter((r) => r.fonte === 'google' && r.dia >= desde)
    .map((r) => r.precoCentavos);
  if (precos.length < MINIMO_PONTOS_REFERENCIA) return null;
  const m = mediana(precos);
  return m === null ? null : Math.round(m);
}

async function atualizarReferencia(
  ctx: ContextoGoogle,
  vigilancia: Vigilancia,
  base: ConsultaVoo,
  agora: Date,
): Promise<void> {
  const serpapi = ctx.serpapi;
  if (!serpapi) return;
  const estado = lerEstado(ctx.db, chaveReferencia(vigilancia.id));
  if (estado) {
    const quando = Date.parse(estado.atualizadoEm);
    const validade = estado.valor === 'ok' ? VALIDADE_REFERENCIA_MS : ESPERA_APOS_ERRO_MS;
    // A viagem mudou depois da busca: a referencia e de outra viagem.
    const mudou = vigilancia.historicoDesde > estado.atualizadoEm;
    if (!mudou && agora.getTime() - quando < validade) return;
  }
  if (!cabe(ctx, 1, agora)) return;
  try {
    const ref = await serpapi.historico(base, vigilancia.origens, vigilancia.destinos);
    registrar(ctx, 1, agora);
    apagarReferencias(ctx.db, vigilancia.id, 'google');
    salvarReferencias(ctx.db, vigilancia.id, 'google', vigilancia.moeda, ref.pontos, agora);
    gravarEstado(ctx.db, chaveReferencia(vigilancia.id), 'ok', agora);
    ctx.log.info(`referência do Google para "${vigilancia.descricao}": ${ref.pontos.length} dia(s) de histórico`);
  } catch (erro) {
    registrar(ctx, 1, agora, resumirErro(erro));
    gravarEstado(ctx.db, chaveReferencia(vigilancia.id), 'erro', agora);
    ctx.log.aviso(`referência do Google para "${vigilancia.descricao}" falhou: ${resumirErro(erro)}`);
  }
}

/**
 * So links https da area de voos do Google entram como link de vendedor. O caminho importa:
 * `google.com/url?q=...` e um redirecionador aberto que levaria a qualquer site.
 */
export function linkGoogleSeguro(link: string | null): string | null {
  if (!link) return null;
  try {
    const u = new URL(link);
    const host = u.hostname === 'www.google.com' || u.hostname === 'google.com';
    return u.protocol === 'https:' && host && u.pathname.startsWith('/travel/flights') ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * Grava "Onde comprar" da oferta: a opcao da propria fonte (com o link de compra dela) e, com
 * SerpApi, o preco do mesmo voo em cada vendedor (3 consultas). Falha do SerpApi nao impede a
 * oferta: fica so a opcao da fonte.
 */
export async function gravarOndeComprar(
  ctx: ContextoGoogle,
  ofertaId: number,
  fonte: FontePreco,
  base: ConsultaVoo,
  itinerario: Itinerario,
  agora: Date,
): Promise<void> {
  const nomeFonte = fonte.vendedor ?? fonte.nome;
  const daFonte: OpcaoCompra = {
    vendedor: nomeFonte,
    precoCentavos: itinerario.precoCentavos,
    moeda: itinerario.moeda,
    estrangeiro: fonte.vendedorEstrangeiro ?? false,
    link: itinerario.linkCompra,
  };
  const opcoes: OpcaoCompra[] = [daFonte];

  if (ctx.serpapi && cabe(ctx, 3, agora)) {
    const gasto = { consultas: 0 };
    try {
      const r = await ctx.serpapi.opcoesDeCompra(base, itinerario, gasto);
      registrar(ctx, r.consultas, agora);
      const link = linkGoogleSeguro(r.linkGoogle);
      for (const o of r.opcoes) {
        if (o.vendedor.trim().toLowerCase() === nomeFonte.toLowerCase()) continue; // a da fonte tem link proprio
        opcoes.push({
          vendedor: o.vendedor,
          precoCentavos: o.precoCentavos,
          moeda: itinerario.moeda,
          estrangeiro: o.estrangeiro,
          ehCompanhia: o.ehCompanhia,
          link,
        });
      }
      if (!r.opcoes.length) ctx.log.info('onde comprar: o voo não apareceu no Google Flights; fica só a opção da fonte');
    } catch (erro) {
      // Conta todas as chamadas tentadas ate a falha, nao so uma.
      registrar(ctx, Math.max(gasto.consultas, 1), agora, resumirErro(erro));
      ctx.log.aviso(`onde comprar: serpapi falhou: ${resumirErro(erro)}`);
    }
  }
  salvarOpcoesCompra(ctx.db, ofertaId, opcoes);
}
