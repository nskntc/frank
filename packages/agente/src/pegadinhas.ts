import type { Itinerario, Perna, TipoPegadinha, Vigilancia } from '@frank/contratos';

/**
 * Pegadinhas que o codigo detecta com certeza a partir dos dados da fonte (SPEC-01 RF-10). O
 * Claude recebe isto como fato: nao repete, nao contesta, nao remove.
 */
export interface Pegadinha {
  tipo: TipoPegadinha;
  descricao: string;
}

/** Limites (calibrar): escala longa acima de 6 h; conexao curta abaixo de 1 h. */
export const ESCALA_LONGA_MIN = 6 * 60;
export const CONEXAO_CURTA_MIN = 60;
/** Tao abaixo do normal que pode ser erro de tarifa (a companhia pode cancelar). */
export const PERCENTUAL_ERRO_TARIFA = 60;

/**
 * Minutos entre dois horarios locais (AAAA-MM-DDTHH:MM[:SS]). So vale no mesmo fuso: numa
 * conexao entre paises com fusos diferentes o valor e aproximado (por isso "cerca de").
 */
function minutosEntre(de: string, ate: string): number {
  return (Date.parse(`${ate}Z`) - Date.parse(`${de}Z`)) / 60_000;
}

function horas(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

function hora(horario: string): number {
  return Number(horario.slice(11, 13));
}

function conexoes(perna: Perna, nome: string): Pegadinha[] {
  const achadas: Pegadinha[] = [];
  for (let i = 0; i + 1 < perna.trechos.length; i++) {
    const chegada = perna.trechos.at(i);
    const saida = perna.trechos.at(i + 1);
    if (!chegada || !saida) continue;
    const espera = minutosEntre(chegada.chegada, saida.partida);
    if (Number.isNaN(espera)) continue;
    if (espera >= ESCALA_LONGA_MIN) {
      achadas.push({ tipo: 'escala_longa', descricao: `Na ${nome}, espera de cerca de ${horas(espera)} em ${chegada.para}.` });
    } else if (espera < CONEXAO_CURTA_MIN) {
      achadas.push({ tipo: 'conexao_curta', descricao: `Na ${nome}, conexão de só ${Math.round(espera)} min em ${chegada.para}.` });
    }
  }
  return achadas;
}

export interface EntradaPegadinhas {
  itinerario: Itinerario;
  vigilancia: Pick<Vigilancia, 'origens' | 'malasDespachadas'>;
  vendedorEstrangeiro: boolean;
  percentualAbaixo: number | null;
}

export function detectarPegadinhas(entrada: EntradaPegadinhas): Pegadinha[] {
  const { itinerario: it } = entrada;
  const achadas: Pegadinha[] = [];

  if (it.volta && it.volta.para !== it.ida.de) {
    achadas.push({
      tipo: 'outro_aeroporto',
      descricao: `A ida sai de ${it.ida.de}, mas a volta chega em ${it.volta.para}.`,
    });
  }

  for (const [perna, nome] of [[it.ida, 'ida'], [it.volta, 'volta']] as const) {
    if (!perna) continue;
    if (hora(perna.partida) < 6) {
      achadas.push({ tipo: 'voo_madrugada', descricao: `A ${nome} sai de madrugada (${perna.partida.slice(11, 16)}).` });
    }
    achadas.push(...conexoes(perna, nome));
  }

  if (it.malas.despachada === 0) {
    achadas.push({
      tipo: 'sem_mala_despachada',
      descricao:
        entrada.vigilancia.malasDespachadas > 0
          ? 'A tarifa não inclui a mala despachada que você pediu.'
          : 'Tarifa só com bagagem de mão; mala despachada é paga à parte.',
    });
  }

  if (entrada.vendedorEstrangeiro) {
    achadas.push({
      tipo: 'vendedor_estrangeiro',
      descricao: 'Vendedor estrangeiro: o preço final já inclui 3,5% de IOF; reembolso e atendimento são mais difíceis.',
    });
  }

  if (entrada.percentualAbaixo !== null && entrada.percentualAbaixo >= PERCENTUAL_ERRO_TARIFA) {
    achadas.push({
      tipo: 'possivel_erro_tarifa',
      descricao: `Preço ${entrada.percentualAbaixo}% abaixo do normal: pode ser erro de tarifa, e a companhia pode cancelar.`,
    });
  }

  return achadas;
}
