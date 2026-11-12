import {
  gravarRodizio,
  listarVigilancias,
  marcarRodada,
  obterRodizio,
  registrarPrecosVistos,
  vigilanciasDevidas,
} from '@frank/banco';
import type { Itinerario, ResultadoRodadaVigilancia, Vigilancia } from '@frank/contratos';
import { planejarConsultas, type PlanoVigilancia } from '@frank/dominio';
import type { ConsultaVoo, FontePreco } from '@frank/fontes';
import {
  type ContextoFonte,
  conferirMoeda,
  podeConsultar,
  registrarConsultaSemLancar,
  resumirErro,
} from './apoio-fonte.js';
import { consultasDaVigilancia, proximaExclusao } from './consultas.js';
import { type ContextoDeteccao, detectarNaRodada } from './detectar.js';

export { resumirErro } from './apoio-fonte.js';

export interface DependenciasRodada extends ContextoFonte {
  fontes: readonly FontePreco[];
  /** O Claude com orcamento, para avaliar as ofertas. Opcional. */
  ia?: ContextoDeteccao['ia'];
  /** Google Flights via SerpApi: referencia de preco e "onde comprar". Opcional. */
  serpapi?: ContextoDeteccao['serpapi'];
  tetoMensalSerpApi?: number;
  /**
   * Maximo de buscas por par origem x destino e fonte numa rodada (RF-05): a primeira sem
   * filtro e as seguintes excluindo as companhias ja vistas. Padrao 3.
   */
  maxBuscasPorPar?: number;
}

export const MAX_BUSCAS_POR_PAR_PADRAO = 3;

export interface ResumoRodada {
  vigilancias: number;
  consultas: number;
  itinerarios: number;
  erros: number;
  /** Consultas nao feitas porque a fonte bateu o teto de 24 h. */
  puladasPorTeto: number;
  /** Ofertas novas, ja reconferidas na fonte. */
  ofertas: number;
}

function novoResultado(): ResultadoRodadaVigilancia {
  return { consultas: 0, itinerarios: 0, erros: 0, puladasPorTeto: 0, ultimoErro: null };
}

/**
 * Uma rodada do vigia: para cada vigilancia devida, consulta cada fonte em cada busca, grava os
 * precos com o mesmo id de rodada e passa o detector de oferta. Falha de uma busca, fonte ou
 * vigilancia nao para as outras (RNF-05). A rodada e marcada mesmo com falha (para nao martelar a
 * fonte no proximo tique), junto com o resultado, para o painel distinguir rodada boa de ruim.
 */
export async function executarRodada(
  deps: DependenciasRodada,
  agora: Date = new Date(),
): Promise<ResumoRodada> {
  const resumo: ResumoRodada = {
    vigilancias: 0,
    consultas: 0,
    itinerarios: 0,
    erros: 0,
    puladasPorTeto: 0,
    ofertas: 0,
  };
  const planos = planosDoVigia(deps);

  for (const vigilancia of vigilanciasDevidas(deps.db, agora)) {
    const plano = planos.get(vigilancia.id);
    if (plano && !venceuNoPlano(vigilancia, plano, agora)) continue;
    resumo.vigilancias++;
    const resultado = novoResultado();
    try {
      // Sem plano (nao deveria acontecer: so ativas sao devidas), consulta tudo como antes.
      const { rodada, inicio } = cicloDaRodada(deps, vigilancia, plano, agora);
      const bases = consultasDaVigilancia(vigilancia);
      const fatia = bases.slice(inicio, inicio + (plano?.paresPorRodada ?? bases.length));
      const cobertos = await rodarVigilancia(deps, vigilancia, fatia, rodada, agora, resultado);
      avancarRodizio(deps, vigilancia, rodada, inicio, cobertos, bases.length);
      if (resultado.itinerarios > 0) {
        try {
          if (await detectarNaRodada(deps, vigilancia, rodada, agora, resultado)) resumo.ofertas++;
        } catch (erro) {
          resultado.erros++;
          resultado.ultimoErro = `detector: ${resumirErro(erro)}`;
          deps.log.erro(`vigilância "${vigilancia.descricao}": ${resultado.ultimoErro}`);
        }
      }
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
        deps.log.erro(
          `não consegui marcar a rodada de "${vigilancia.descricao}": ${resumirErro(erro)}`,
        );
      }
    }
  }
  return resumo;
}

/**
 * O plano de consultas de todas as vigilancias ativas (issue #19): quantos pares cada uma consulta
 * por rodada e de quanto em quanto tempo, para todas juntas caberem no teto diario.
 */
export function planosDoVigia(deps: DependenciasRodada): Map<string, PlanoVigilancia> {
  const maxBuscas = deps.maxBuscasPorPar ?? MAX_BUSCAS_POR_PAR_PADRAO;
  return planejarConsultas(
    listarVigilancias(deps.db, { soAtivas: true }).map((v) => ({
      id: v.id,
      pares: v.origens.length * v.destinos.length,
      buscasPorPar: v.companhias.length ? 1 : maxBuscas,
      intervaloMinutos: v.intervaloMinutos,
    })),
    deps.tetoDiarioPorFonte,
  );
}

/** Com intervalo aumentado pelo plano, a vigilancia so roda quando esse intervalo venceu. */
function venceuNoPlano(v: Vigilancia, plano: PlanoVigilancia, agora: Date): boolean {
  if (v.ultimaRodadaEm === null) return true;
  const ultima = Date.parse(v.ultimaRodadaEm);
  return Number.isNaN(ultima) || ultima + plano.intervaloMinutos * 60_000 <= agora.getTime();
}

/**
 * Continua o ciclo em andamento (mesmo id de rodada, a partir do proximo par) ou comeca outro.
 * Ciclo velho demais (vigia desligado por muito tempo) recomeca: precos de dias atras nao se
 * misturam com os de agora na mesma "rodada".
 */
function cicloDaRodada(
  deps: DependenciasRodada,
  v: Vigilancia,
  plano: PlanoVigilancia | undefined,
  agora: Date,
): { rodada: string; inicio: number } {
  const novo = { rodada: agora.toISOString(), inicio: 0 };
  const r = obterRodizio(deps.db, v.id);
  if (!r || !plano || r.proximoPar >= plano.pares) return novo;
  const idade = agora.getTime() - Date.parse(r.ciclo);
  if (Number.isNaN(idade) || idade > 2 * plano.minutosParaCobrirTodos * 60_000) return novo;
  return { rodada: r.ciclo, inicio: r.proximoPar };
}

/**
 * Grava onde o rodizio parou. Par que nao chegou a ser consultado (teto) fica para a proxima
 * rodada: assim nunca sao sempre os mesmos pares de fora.
 */
function avancarRodizio(
  deps: DependenciasRodada,
  v: Vigilancia,
  rodada: string,
  inicio: number,
  cobertos: number,
  pares: number,
): void {
  const proximo = inicio + cobertos;
  if (cobertos === 0 && inicio === 0) return;
  gravarRodizio(deps.db, v.id, proximo >= pares ? null : { ciclo: rodada, proximoPar: proximo });
}

/** Consulta os pares da fatia. Devolve quantos pares tiveram ao menos uma consulta. */
async function rodarVigilancia(
  deps: DependenciasRodada,
  vigilancia: Vigilancia,
  fatia: readonly ConsultaVoo[],
  rodada: string,
  agora: Date,
  resultado: ResultadoRodadaVigilancia,
): Promise<number> {
  const maxBuscas = deps.maxBuscasPorPar ?? MAX_BUSCAS_POR_PAR_PADRAO;
  let cobertos = 0;

  for (const base of fatia) {
    const antes = resultado.consultas;
    for (const fonte of deps.fontes) {
      let excluidas: string[] = [];
      for (let busca = 0; busca < maxBuscas; busca++) {
        if (!podeConsultar(deps, fonte.nome, agora, resultado)) break;
        const consulta = excluidas.length ? { ...base, excluirCompanhias: excluidas } : base;
        resultado.consultas++;
        const itinerarios = await consultarEGravar(
          deps,
          fonte,
          consulta,
          vigilancia,
          rodada,
          agora,
          resultado,
        );
        // Com companhias escolhidas pela pessoa, nao ha o que excluir: uma busca so.
        if (itinerarios === null || base.companhias?.length) break;
        const proxima = proximaExclusao(itinerarios, fonte.limiteResultados, excluidas);
        if (proxima === null) break;
        excluidas = proxima;
      }
    }
    // Nenhuma consulta neste par: a fonte bateu o teto. O resto fica para a proxima rodada.
    if (resultado.consultas === antes) break;
    cobertos++;
  }
  return cobertos;
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
  const excluindo = consulta.excluirCompanhias?.length
    ? ` sem ${consulta.excluirCompanhias.join(',')}`
    : '';
  const rotulo = `${fonte.nome} ${consulta.origem}→${consulta.destino}${excluindo}`;

  // 1. A busca: erro aqui e da fonte.
  let itinerarios: Itinerario[];
  try {
    itinerarios = await fonte.buscar(consulta);
  } catch (erro) {
    resultado.erros++;
    resultado.ultimoErro = `${rotulo}: ${resumirErro(erro)}`;
    registrarConsultaSemLancar(
      deps,
      fonte.nome,
      { sucesso: false, erro: resumirErro(erro) },
      agora,
    );
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
