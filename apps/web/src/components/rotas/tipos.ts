import type { NovaVigilancia, Vigilancia } from '@frank/contratos';
import type { Estimativa } from '@/lib/estimativa';

export interface Plano {
  vigilancia: NovaVigilancia;
  duvidas: string[];
  resumo: string;
  estimativa: Estimativa;
}

export type VigilanciaNaTela = Vigilancia & { estimativa: Estimativa };
