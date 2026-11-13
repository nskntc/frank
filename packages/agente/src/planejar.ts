import { type NovaVigilancia, novaVigilanciaSchema, temFiltros } from '@frank/contratos';
import type { ProvedorLLM } from '@frank/ia';
import { z } from 'zod';
import { montarSistema } from './skills.js';
import { neutralizarTexto } from './texto.js';

/** O que o Claude devolve ao ler o pedido. Sem refinamentos: eles nao cabem no JSON Schema. */
export const planoSchema = z
  .object({
    origens: z.array(z.string()),
    destinos: z.array(z.string()),
    idaDe: z.string(),
    idaAte: z.string(),
    voltaDe: z.string().nullable(),
    voltaAte: z.string().nullable(),
    adultos: z.number().int(),
    malasDespachadas: z.number().int(),
    maxEscalas: z.number().int().nullable(),
    companhias: z.array(z.string()),
    aceitarPassagensSeparadas: z.boolean(),
    precoAlvoCentavos: z.number().int().nullable(),
    // Filtros de horario e duracao (issue #21). Formato conferido no contrato (filtrosSchema).
    duracaoMaximaHoras: z.number().int().nullable(),
    idaPartidaApos: z.string().nullable(),
    idaChegadaAte: z.string().nullable(),
    voltaPartidaApos: z.string().nullable(),
    voltaChegadaAte: z.string().nullable(),
    // Limites cabem no JSON Schema: o proprio Claude ja respeita, e o Zod confere.
    // Vao para o painel como texto puro (nunca HTML, nunca link).
    duvidas: z.array(z.string().max(200)).max(10),
    resumo: z.string().max(300),
  })
  .strict();

export type PlanoIa = z.infer<typeof planoSchema>;

export interface PlanoVigilancia {
  /** Pronta para gravar depois que a pessoa confirmar no painel. */
  vigilancia: NovaVigilancia;
  /** Suposicoes que a pessoa pode querer corrigir. */
  duvidas: string[];
  resumo: string;
}

/** O pedido foi entendido, mas o resultado nao forma uma vigilancia valida. */
export class PlanoInvalidoError extends Error {
  constructor(readonly problemas: string[]) {
    super(`Não consegui montar a vigilância: ${problemas.join('; ')}`);
    this.name = 'PlanoInvalidoError';
  }
}

export const INTERVALO_PADRAO_MINUTOS = 60;
const TAMANHO_MAXIMO_PEDIDO = 300;

function diaDeHoje(agora: Date): string {
  return agora.toISOString().slice(0, 10);
}

/** O pedido vai entre <pedido> e </pedido>, neutralizado (texto.ts). */
export const neutralizarPedido = neutralizarTexto;

/**
 * Transforma o pedido em texto livre numa vigilancia (SPEC-01 RF-01). O Claude so interpreta;
 * descricao, moeda, intervalo e a validacao final ficam com o codigo. Nada e gravado aqui: o
 * painel mostra o plano e so salva depois da confirmacao.
 */
export async function planejarVigilancia(
  ia: ProvedorLLM,
  pedido: string,
  agora: Date = new Date(),
): Promise<PlanoVigilancia> {
  const texto = pedido.trim();
  if (!texto) throw new PlanoInvalidoError(['o pedido está vazio']);
  if (texto.length > TAMANHO_MAXIMO_PEDIDO) {
    throw new PlanoInvalidoError([`o pedido passa de ${TAMANHO_MAXIMO_PEDIDO} caracteres`]);
  }

  const hoje = diaDeHoje(agora);
  const { dados } = await ia.perguntar({
    tarefa: 'planejar',
    sistema: montarSistema(['entender_pedido', 'estrategias_de_busca']),
    mensagem: `Hoje é ${hoje}.\n\n<pedido>\n${neutralizarPedido(texto)}\n</pedido>`,
    schema: planoSchema,
  });

  const vigilancia = {
    descricao: texto,
    origens: dados.origens.map((c) => c.toUpperCase()),
    destinos: dados.destinos.map((c) => c.toUpperCase()),
    idaDe: dados.idaDe,
    idaAte: dados.idaAte,
    voltaDe: dados.voltaDe,
    voltaAte: dados.voltaAte,
    adultos: dados.adultos,
    malasDespachadas: dados.malasDespachadas,
    maxEscalas: dados.maxEscalas,
    companhias: dados.companhias.map((c) => c.toUpperCase()),
    aceitarPassagensSeparadas: dados.aceitarPassagensSeparadas,
    precoAlvoCentavos: dados.precoAlvoCentavos,
    moeda: 'BRL',
    intervaloMinutos: INTERVALO_PADRAO_MINUTOS,
    filtros: {
      duracaoMaximaHoras: dados.duracaoMaximaHoras,
      idaPartidaApos: dados.idaPartidaApos,
      idaChegadaAte: dados.idaChegadaAte,
      // So ida: filtro de volta nao tem o que filtrar.
      voltaPartidaApos: dados.voltaDe === null ? null : dados.voltaPartidaApos,
      voltaChegadaAte: dados.voltaDe === null ? null : dados.voltaChegadaAte,
    },
  };

  // As mensagens citam so o nome do campo e a regra, nunca o valor que veio do modelo.
  const validada = novaVigilanciaSchema.safeParse(vigilancia);
  if (!validada.success) {
    throw new PlanoInvalidoError(
      validada.error.issues.map((i) => `${i.path.join('.') || 'vigilância'}: ${i.message}`),
    );
  }
  if (validada.data.idaDe < hoje) throw new PlanoInvalidoError(['a data de ida já passou']);

  // Filtros todos null equivalem a nenhum: a vigilancia sai sem o campo.
  const { filtros, ...resto } = validada.data;
  return {
    vigilancia: temFiltros(filtros) ? { ...resto, filtros } : resto,
    duvidas: dados.duvidas,
    resumo: dados.resumo,
  };
}
