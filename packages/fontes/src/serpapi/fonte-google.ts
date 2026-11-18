import type { Itinerario } from '@frank/contratos';
import { type ConsultaVoo, FonteIndisponivelError, type FontePreco } from '../fonte.js';
import type { SerpApiGoogleFlights } from './serpapi.js';
import { NOME_FONTE_GOOGLE } from './voos.js';

export interface CotaSerpApi {
  /** Ainda cabem `n` consultas da SerpApi (teto mensal e diario)? */
  cabe(n: number): boolean;
  /** Registra `n` consultas gastas (com erro, se a busca falhou). */
  gastou(n: number, erro?: string): void;
}

/**
 * Google Flights como fonte de voos (issue #27). Cada busca e um dia de ida (e um de volta) e
 * custa 1 consulta da SerpApi so ida, 2 ida e volta: a cota e conferida antes e registrada depois,
 * aqui, porque o vigia so ve uma "busca".
 */
export class FonteGoogle implements FontePreco {
  readonly nome = NOME_FONTE_GOOGLE;
  readonly vendedor = 'Google Flights';
  /** O link abre o Google Flights, onde a pessoa escolhe quem vende (em geral a companhia). */
  readonly vendedorEstrangeiro = false;
  readonly umDiaPorBusca = true;

  constructor(
    private readonly serpapi: Pick<SerpApiGoogleFlights, 'voos'>,
    private readonly cota: CotaSerpApi,
  ) {}

  /** Consultas que uma busca gasta. */
  static custo(consulta: Pick<ConsultaVoo, 'volta'>): number {
    return consulta.volta ? 2 : 1;
  }

  async buscar(consulta: ConsultaVoo): Promise<Itinerario[]> {
    const custo = FonteGoogle.custo(consulta);
    if (!this.cota.cabe(custo)) {
      throw new FonteIndisponivelError(this.nome, 'cota da SerpApi do dia ou do mês esgotada');
    }
    const gasto = { consultas: 0 };
    try {
      const voos = await this.serpapi.voos(consulta, gasto);
      this.cota.gastou(gasto.consultas);
      return voos;
    } catch (erro) {
      this.cota.gastou(Math.max(gasto.consultas, 1), erro instanceof Error ? erro.message : 'erro');
      throw erro;
    }
  }
}
