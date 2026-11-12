/**
 * Quantas consultas cada vigilancia pode gastar por dia, e como (issue #19).
 *
 * O teto de consultas e por fonte, nas ultimas 24 h, e vale para todas as vigilancias juntas.
 * Uma vigilancia ampla (ex.: 2 origens x 5 destinos) passa do teto se consultar todos os pares em
 * toda rodada. Em vez de bater o teto e deixar sempre os mesmos pares de fora, o vigia:
 * 1. divide o orcamento do dia entre as vigilancias ativas, de forma justa (quem precisa de pouco
 *    leva so o que precisa; a sobra vai para as maiores);
 * 2. se a vigilancia nao cabe inteira, reveza os pares: cada rodada cobre uma parte, e todos sao
 *    cobertos ao longo de algumas horas;
 * 3. se nem um par por rodada cabe, aumenta o intervalo entre as rodadas.
 */

/** Parte do teto que o planejamento usa. O resto e folga (reconferencia de oferta, relogio). */
export const PARTE_DO_TETO = 0.8;

const MINUTOS_NO_DIA = 24 * 60;

export interface NecessidadeVigilancia {
  id: string;
  /** Pares origem x destino. */
  pares: number;
  /** Buscas por par numa rodada, no pior caso (busca adaptativa: ate 3; com companhia: 1). */
  buscasPorPar: number;
  /** O intervalo que a pessoa escolheu. */
  intervaloMinutos: number;
}

export interface PlanoVigilancia {
  pares: number;
  /** Pares consultados em cada rodada. Igual a `pares` = sem rodizio. */
  paresPorRodada: number;
  /** Intervalo de verdade: o escolhido, ou maior se nem um par por rodada cabia. */
  intervaloMinutos: number;
  /** Pior caso, com o rodizio e o intervalo aplicados. */
  consultasPorDia: number;
  /** Pior caso sem o rodizio: o que a vigilancia gastaria consultando tudo sempre. */
  consultasSemRodizio: number;
  /** De quanto em quanto tempo todos os pares sao consultados ao menos uma vez. */
  minutosParaCobrirTodos: number;
  /** Teve rodizio ou intervalo maior. */
  ajustado: boolean;
}

function rodadasPorDia(intervaloMinutos: number): number {
  return Math.ceil(MINUTOS_NO_DIA / intervaloMinutos);
}

function necessidade(n: NecessidadeVigilancia): number {
  return n.pares * n.buscasPorPar * rodadasPorDia(n.intervaloMinutos);
}

/**
 * Divide `orcamento` entre as necessidades, de forma justa (enchimento por nivel): as menores
 * recebem tudo o que pedem; a sobra e repartida igualmente entre as que pedem mais.
 */
export function dividirOrcamento(necessidades: readonly number[], orcamento: number): number[] {
  const cotas = necessidades.map(() => 0);
  const ordem = necessidades
    .map((_, i) => i)
    .sort((a, b) => (necessidades[a] ?? 0) - (necessidades[b] ?? 0));
  let resta = orcamento;
  ordem.forEach((i, k) => {
    const parte = Math.floor(resta / (ordem.length - k));
    const cota = Math.min(necessidades[i] ?? 0, parte);
    cotas[i] = cota;
    resta -= cota;
  });
  return cotas;
}

/** O plano de uma vigilancia com a cota de consultas por dia que coube a ela. */
export function planoComCota(n: NecessidadeVigilancia, cota: number): PlanoVigilancia {
  const consultasSemRodizio = necessidade(n);
  const rodadas = rodadasPorDia(n.intervaloMinutos);
  const porRodadaPorPar = n.buscasPorPar * rodadas;
  const pares = Math.max(1, n.pares);

  let paresPorRodada = Math.min(pares, Math.floor(cota / porRodadaPorPar));
  let intervaloMinutos = n.intervaloMinutos;
  if (paresPorRodada < 1) {
    // Nem um par por rodada cabe: um par por rodada, com rodadas mais espacadas.
    paresPorRodada = 1;
    intervaloMinutos = Math.max(
      n.intervaloMinutos,
      Math.ceil((MINUTOS_NO_DIA * n.buscasPorPar) / Math.max(1, cota)),
    );
  }
  const rodadasDeVerdade = rodadasPorDia(intervaloMinutos);
  return {
    pares,
    paresPorRodada,
    intervaloMinutos,
    consultasPorDia: paresPorRodada * n.buscasPorPar * rodadasDeVerdade,
    consultasSemRodizio,
    minutosParaCobrirTodos: Math.ceil(pares / paresPorRodada) * intervaloMinutos,
    ajustado: paresPorRodada < pares || intervaloMinutos !== n.intervaloMinutos,
  };
}

/**
 * O plano de todas as vigilancias ativas, com o teto diario por fonte. A soma do pior caso de
 * todas cabe em `PARTE_DO_TETO` do teto (salvo quando ha tantas vigilancias que nem um par por
 * dia caberia para cada uma; ai o teto do vigia ainda segura).
 */
export function planejarConsultas(
  vigilancias: readonly NecessidadeVigilancia[],
  tetoDiario: number,
): Map<string, PlanoVigilancia> {
  const orcamento = Math.floor(tetoDiario * PARTE_DO_TETO);
  const cotas = dividirOrcamento(vigilancias.map(necessidade), orcamento);
  return new Map(vigilancias.map((n, i) => [n.id, planoComCota(n, cotas[i] ?? 0)]));
}
