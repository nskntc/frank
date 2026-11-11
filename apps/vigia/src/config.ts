/** Configuracao do vigia por variavel de ambiente, com valores iniciais a calibrar. */
export interface ConfigVigia {
  /** Maximo de consultas por fonte nas ultimas 24 h (SPEC-01 RF-04, calibrar). */
  tetoDiarioPorFonte: number;
  /** Buscas por par de aeroportos e fonte numa rodada (RF-05, calibrar). */
  maxBuscasPorPar: number;
  tiqueMs: number;
  /** Chamadas ao Claude em 24 h (RNF-03, calibrar). */
  limiteDiarioIa: number;
  /** Modelo do Claude (ex.: 'haiku', 'sonnet'). Vazio = o padrao do plano. */
  modeloIa: string;
}

function inteiroPositivo(valor: string | undefined, nome: string, padrao: number): number {
  if (valor === undefined || valor === '') return padrao;
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) {
    throw new RangeError(`${nome} precisa ser um inteiro positivo (recebido: "${valor}")`);
  }
  return n;
}

export function lerConfig(env: NodeJS.ProcessEnv = process.env): ConfigVigia {
  return {
    tetoDiarioPorFonte: inteiroPositivo(env.FRANK_TETO_DIARIO_FONTE, 'FRANK_TETO_DIARIO_FONTE', 300),
    maxBuscasPorPar: inteiroPositivo(env.FRANK_MAX_BUSCAS_POR_PAR, 'FRANK_MAX_BUSCAS_POR_PAR', 3),
    tiqueMs: inteiroPositivo(env.FRANK_TIQUE_MS, 'FRANK_TIQUE_MS', 60_000),
    limiteDiarioIa: inteiroPositivo(env.FRANK_LIMITE_DIARIO_IA, 'FRANK_LIMITE_DIARIO_IA', 30),
    modeloIa: env.FRANK_MODELO ?? '',
  };
}
