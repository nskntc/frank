import {
  apagarEstado,
  type Banco,
  CHAVES_ESTADO,
  contarConsultas,
  gravarEstado,
  marcarRodada,
  registrarConsulta,
  registrarPrecosVistos,
  vigilanciasDevidas,
} from '@frank/banco';
import type { Itinerario, ResultadoRodadaVigilancia, Vigilancia } from '@frank/contratos';
import type { ConsultaVoo, FontePreco } from '@frank/fontes';
import { consultasDaVigilancia, proximaExclusao } from './consultas.js';
import type { Logger } from './log.js';

const UM_DIA_MS = 86_400_000;

export interface DependenciasRodada {
  db: Banco;
  fontes: readonly FontePreco[];
  /** Maximo de consultas por fonte nas ultimas 24 h (SPEC-01 RF-04). */
  tetoDiarioPorFonte: number;
  /**
   * Maximo de buscas por par origem x destino e fonte numa rodada (RF-05): a primeira sem
   * filtro e as seguintes excluindo as companhias ja vistas. Padrao 3.
   */
  maxBuscasPorPar?: number;
  log: Logger;
}

export const MAX_BUSCAS_POR_PAR_PADRAO = 3;

export interface ResumoRodada {
  vigilancias: number;
  consultas: number;
  itinerarios: number;
  erros: number;
  /** Consultas nao feitas porque a fonte bateu o teto de 24 h. */
  puladasPorTeto: number;
}

/** Mensagem curta de erro para o banco e o log: sem pilha, sem token. */
export function resumirErro(erro: unknown): string {
  const texto = erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro);
  return texto.slice(0, 200);
}

function novoResultado(): ResultadoRodadaVigilancia {
  return { consultas: 0, itinerarios: 0, erros: 0, puladasPorTeto: 0, ultimoErro: null };
}

/**
 * Uma rodada do vigia: para cada vigilancia devida, consulta cada fonte em cada busca e grava os
 * precos com o mesmo id de rodada. Falha de uma busca, fonte ou vigilancia nao para as outras
 * (RNF-05). A rodada e marcada mesmo com falha (para nao martelar a fonte no proximo tique), junto
 * com o resultado, para o painel distinguir rodada boa de rodada que falhou.
 */
export async function executarRodada(
  deps: DependenciasRodada,
  agora: Date = new Date(),
): Promise<ResumoRodada> {
  const resumo: ResumoRodada = { vigilancias: 0, consultas: 0, itinerarios: 0, erros: 0, puladasPorTeto: 0 };
  const rodada = agora.toISOString();

  for (const vigilancia of vigilanciasDevidas(deps.db, agora)) {
    resumo.vigilancias++;
    const resultado = novoResultado();
    try {
      await rodarVigilancia(deps, vigilancia, rodada, agora, resultado);
    } catch (erro) {
      // Erro inesperado: registra e segue para a proxima vigilancia.
      resultado.erros++;
      resultado.ultimoErro = resumirErro(erro);
      deps.log.erro(`vigilância "${vigilancia.descricao}": ${resultado.ultimoErro}`);
    } finally {
      resumo.consultas += resultado.consultas;
      resumo.itinerarios += resultado.itinerarios;
      resumo.erros += resultado.erros;
      resumo.puladasPorTeto += resultado.puladasPorTeto;
      try {
        marcarRodada(deps.db, vigilancia.id, agora, resultado);
      } catch (erro) {
        resumo.erros++;
        deps.log.erro(`não consegui marcar a rodada de "${vigilancia.descricao}": ${resumirErro(erro)}`);
      }
    }
  }
  return resumo;
}

/** Moeda diferente da pedida nunca entra no historico calada: viraria preco sem mediana. */
function conferirMoeda(itinerarios: readonly Itinerario[], moeda: string): string | null {
  const outra = itinerarios.find((it) => it.moeda !== moeda);
  return outra ? `respondeu em ${outra.moeda}, pedido em ${moeda}` : null;
}

function registrarConsultaSemLancar(
  deps: DependenciasRodada,
  fonte: string,
  r: { sucesso: boolean; erro?: string },
  agora: Date,
): void {
  try {
    registrarConsulta(deps.db, fonte, r, agora);
  } catch (erro) {
    deps.log.erro(`não consegui registrar a consulta à ${fonte}: ${resumirErro(erro)}`);
  }
}

async function rodarVigilancia(
  deps: DependenciasRodada,
  vigilancia: Vigilancia,
  rodada: string,
  agora: Date,
  resultado: ResultadoRodadaVigilancia,
): Promise<void> {
  const maxBuscas = deps.maxBuscasPorPar ?? MAX_BUSCAS_POR_PAR_PADRAO;

  for (const base of consultasDaVigilancia(vigilancia)) {
    for (const fonte of deps.fontes) {
      let excluidas: string[] = [];
      for (let busca = 0; busca < maxBuscas; busca++) {
        if (!podeConsultar(deps, fonte.nome, agora, resultado)) break;
        const consulta = excluidas.length ? { ...base, excluirCompanhias: excluidas } : base;
        resultado.consultas++;
        const itinerarios = await consultarEGravar(deps, fonte, consulta, vigilancia, rodada, agora, resultado);
        // Com companhias escolhidas pela pessoa, nao ha o que excluir: uma busca so.
        if (itinerarios === null || base.companhias?.length) break;
        const proxima = proximaExclusao(itinerarios, fonte.limiteResultados, excluidas);
        if (proxima === null) break;
        excluidas = proxima;
      }
    }
  }
}

/** Confere o teto de 24 h da fonte. Atingido: fica gravado para o painel e na rodada. */
function podeConsultar(
  deps: DependenciasRodada,
  fonte: string,
  agora: Date,
  resultado: ResultadoRodadaVigilancia,
): boolean {
  const desde24h = new Date(agora.getTime() - UM_DIA_MS);
  if (contarConsultas(deps.db, fonte, desde24h) >= deps.tetoDiarioPorFonte) {
    resultado.puladasPorTeto++;
    resultado.ultimoErro = `${fonte}: teto de ${deps.tetoDiarioPorFonte} consultas em 24 h atingido`;
    gravarEstado(deps.db, CHAVES_ESTADO.teto(fonte), String(deps.tetoDiarioPorFonte), agora);
    deps.log.aviso(resultado.ultimoErro);
    return false;
  }
  apagarEstado(deps.db, CHAVES_ESTADO.teto(fonte));
  return true;
}

async function consultarEGravar(
  deps: DependenciasRodada,
  fonte: FontePreco,
  consulta: ConsultaVoo,
  vigilancia: Vigilancia,
  rodada: string,
  agora: Date,
  resultado: ResultadoRodadaVigilancia,
): Promise<Itinerario[] | null> {
  const excluindo = consulta.excluirCompanhias?.length ? ` sem ${consulta.excluirCompanhias.join(',')}` : '';
  const rotulo = `${fonte.nome} ${consulta.origem}→${consulta.destino}${excluindo}`;

  // 1. A busca: erro aqui e da fonte.
  let itinerarios: Itinerario[];
  try {
    itinerarios = await fonte.buscar(consulta);
  } catch (erro) {
    resultado.erros++;
    resultado.ultimoErro = `${rotulo}: ${resumirErro(erro)}`;
    registrarConsultaSemLancar(deps, fonte.nome, { sucesso: false, erro: resumirErro(erro) }, agora);
    deps.log.aviso(resultado.ultimoErro);
    return null;
  }

  const moedaErrada = conferirMoeda(itinerarios, vigilancia.moeda);
  if (moedaErrada) {
    resultado.erros++;
    resultado.ultimoErro = `${rotulo}: ${moedaErrada}`;
    registrarConsultaSemLancar(deps, fonte.nome, { sucesso: false, erro: moedaErrada }, agora);
    deps.log.aviso(resultado.ultimoErro);
    return null;
  }
  registrarConsultaSemLancar(deps, fonte.nome, { sucesso: true }, agora);

  // 2. A gravacao: erro aqui e do vigia (banco, vigilancia apagada no meio), nao da fonte.
  try {
    registrarPrecosVistos(deps.db, vigilancia.id, rodada, itinerarios, agora);
    resultado.itinerarios += itinerarios.length;
    return itinerarios;
  } catch (erro) {
    resultado.erros++;
    resultado.ultimoErro = `não consegui gravar os preços de ${rotulo}: ${resumirErro(erro)}`;
    deps.log.erro(resultado.ultimoErro);
    return null;
  }
}
