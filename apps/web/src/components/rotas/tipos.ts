import type { NovaVigilancia, Vigilancia } from '@frank/contratos';
import type { Estimativa } from '@/lib/estimativa';

export interface Plano {
  vigilancia: NovaVigilancia;
  duvidas: string[];
  resumo: string;
  estimativa: Estimativa;
}

/** `jaAchouVoo`: a fonte ja trouxe algum voo desde a ultima mudanca da viagem (issue #22). */
export type VigilanciaNaTela = Vigilancia & { estimativa: Estimativa; jaAchouVoo: boolean };
