import type { NovaVigilancia } from '@frank/contratos';
import { planoComCota, planejarConsultas, type PlanoVigilancia } from '@frank/dominio';

/** Teto diario de consultas a fonte (FRANK_TETO_DIARIO_FONTE, padrao 300), o mesmo do vigia. */
export const TETO_DIARIO_PADRAO = 300;
/** Ate quantas buscas por par o vigia faz por rodada (FRANK_MAX_BUSCAS_POR_PAR, padrao 3). */
export const BUSCAS_POR_PAR = 3;

export type Estimativa = PlanoVigilancia;

type VigilanciaParaEstimar = Pick<
  NovaVigilancia,
  'origens' | 'destinos' | 'intervaloMinutos' | 'companhias'
>;

export interface LimitesDoVigia {
  tetoDiario: number;
  buscasPorPar: number;
}

function inteiroOu(valor: string | undefined, padrao: number): number {
  const n = Number(valor);
  return valor && Number.isInteger(n) && n > 0 ? n : padrao;
}

/** Os mesmos limites que o vigia le do .env, para a estimativa bater com o que ele faz. */
export function limitesDoAmbiente(
  env: Record<string, string | undefined> = process.env,
): LimitesDoVigia {
  return {
    tetoDiario: inteiroOu(env.FRANK_TETO_DIARIO_FONTE, TETO_DIARIO_PADRAO),
    buscasPorPar: inteiroOu(env.FRANK_MAX_BUSCAS_POR_PAR, BUSCAS_POR_PAR),
  };
}

const necessidade = (id: string, v: VigilanciaParaEstimar, buscasPorPar: number) => ({
  id,
  pares: v.origens.length * v.destinos.length,
  buscasPorPar: v.companhias.length ? 1 : buscasPorPar,
  intervaloMinutos: v.intervaloMinutos,
});

/**
 * Quantas consultas por dia a vigilancia vai gastar, junto com as outras ativas (issue #19), e
 * como o vigia faz caber no teto: rodizio de pares e, se preciso, intervalo maior. E a mesma
 * conta do vigia (`planejarConsultas`). Mostrada antes de salvar e em cada rota.
 */
export function estimarConsultas(
  v: VigilanciaParaEstimar,
  outrasAtivas: readonly VigilanciaParaEstimar[] = [],
  limites: LimitesDoVigia = { tetoDiario: TETO_DIARIO_PADRAO, buscasPorPar: BUSCAS_POR_PAR },
): Estimativa {
  const esta = necessidade('esta', v, limites.buscasPorPar);
  const todas = [
    esta,
    ...outrasAtivas.map((o, i) => necessidade(`outra-${i}`, o, limites.buscasPorPar)),
  ];
  return planejarConsultas(todas, limites.tetoDiario).get('esta') ?? planoComCota(esta, 0);
}

/** 90 -> "1 h 30 min"; 240 -> "4 h"; 45 -> "45 min". */
export function emHoras(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Texto curto do plano: "todos os 10 pares a cada 4 h (3 por checagem)". */
export function descreverRodizio(e: Estimativa): string {
  const quando = emHoras(e.minutosParaCobrirTodos);
  const porChecagem =
    e.paresPorRodada === 1 ? '1 por checagem' : `${e.paresPorRodada} por checagem`;
  return `todos os ${e.pares} pares a cada ${quando} (${porChecagem})`;
}
