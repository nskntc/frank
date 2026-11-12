import type { AvisoEntregue, RegistroPlacar } from '@frank/banco';
import { intervalo } from './formatar';

/**
 * Preco "igual" entre Frank e Google: ate 2% de diferenca. As fontes arredondam diferente e o
 * Google mostra o preco de um dos sites; sem margem, R$ 1 a mais viraria derrota.
 */
export const MARGEM_MESMO_PRECO_PCT = 2;

export interface LinhaPlacar {
  chave: string;
  quem: 'frank' | 'google';
  /** Instante ISO em que o aviso chegou. */
  vistoEm: string;
  precoCentavos: number;
  /** Conferido ate a tela de pagamento. Null para o aviso automatico do Frank. */
  confirmado: boolean | null;
  observacao: string | null;
  /** Id do registro feito a mao (pode ser apagado). Null para o aviso automatico do Frank. */
  registroId: number | null;
  /** Quem marca ponto com esta linha. Null: nao conta (repetido ou ja disputado na outra linha). */
  ponto: 'frank' | 'google' | null;
  /** Frank x Google na mesma faixa de preco: ms entre um e outro (positivo = Frank antes). */
  vantagemFrankMs: number | null;
  motivo:
    | 'frank_antes'
    | 'frank_depois'
    | 'frank_nao_achou'
    | 'so_frank'
    | 'frank_primeiro'
    | 'google_ja_tinha'
    | 'disputado'
    | 'repetido';
}

export interface Placar {
  linhas: LinhaPlacar[];
  pontos: { frank: number; google: number };
  menor: { frank: number | null; google: number | null };
}

const mesmoOuMenor = (preco: number, referencia: number) =>
  preco * 100 <= referencia * (100 + MARGEM_MESMO_PRECO_PCT);

interface Aviso {
  quem: 'frank' | 'google';
  vistoEm: string;
  t: number;
  precoCentavos: number;
  confirmado: boolean | null;
  observacao: string | null;
  registroId: number | null;
}

/**
 * Placar de uma rota (RF-20). Cada alerta do Google e uma disputa: o Frank ja tinha avisado um
 * preco igual ou menor antes? Ponto do Frank. Avisou depois, ou nunca? Ponto do Google. Cada novo
 * menor preco do Frank que o Google ainda nao tinha avisado (e que nenhum alerta do Google ja
 * disputou) tambem e ponto do Frank.
 * So entram avisos na moeda da vigilancia.
 */
export function montarPlacar(
  doFrank: readonly AvisoEntregue[],
  registros: readonly RegistroPlacar[],
  moeda: string,
): Placar {
  const avisos: Aviso[] = [
    ...doFrank
      .filter((a) => a.moeda === moeda)
      .map((a) => ({
        quem: 'frank' as const,
        vistoEm: a.enviadoEm,
        t: Date.parse(a.enviadoEm),
        precoCentavos: a.precoCentavos,
        confirmado: null,
        observacao: null,
        registroId: null,
      })),
    ...registros
      .filter((r) => r.moeda === moeda)
      .map((r) => ({
        quem: r.quem,
        vistoEm: r.vistoEm,
        t: Date.parse(r.vistoEm),
        precoCentavos: r.precoCentavos,
        confirmado: r.confirmado,
        observacao: r.observacao,
        registroId: r.id,
      })),
  ].sort((a, b) => a.t - b.t || (a.quem === b.quem ? 0 : a.quem === 'frank' ? -1 : 1));

  const frank = avisos.filter((a) => a.quem === 'frank');
  const google = avisos.filter((a) => a.quem === 'google');
  // O aviso do Frank que cada alerta do Google disputa: o primeiro com preco igual ou menor.
  const alcanceDe = (g: Aviso) => frank.find((f) => mesmoOuMenor(f.precoCentavos, g.precoCentavos));
  const disputados = new Set(google.map(alcanceDe).filter((f): f is Aviso => f !== undefined));
  let menorFrankAteAgora = Infinity;

  const linhas = avisos.map((a, i): LinhaPlacar => {
    const base = {
      chave: `${a.quem}:${a.registroId ?? 'auto'}:${a.vistoEm}:${i}`,
      quem: a.quem,
      vistoEm: a.vistoEm,
      precoCentavos: a.precoCentavos,
      confirmado: a.confirmado,
      observacao: a.observacao,
      registroId: a.registroId,
    };
    if (a.quem === 'google') {
      const alcance = alcanceDe(a);
      if (!alcance)
        return { ...base, ponto: 'google', vantagemFrankMs: null, motivo: 'frank_nao_achou' };
      const vantagem = a.t - alcance.t;
      return vantagem >= 0
        ? { ...base, ponto: 'frank', vantagemFrankMs: vantagem, motivo: 'frank_antes' }
        : { ...base, ponto: 'google', vantagemFrankMs: vantagem, motivo: 'frank_depois' };
    }
    const novoMenor = a.precoCentavos < menorFrankAteAgora;
    menorFrankAteAgora = Math.min(menorFrankAteAgora, a.precoCentavos);
    if (!novoMenor) return { ...base, ponto: null, vantagemFrankMs: null, motivo: 'repetido' };
    // Ja disputado na linha de um alerta do Google: o ponto conta la, nao duas vezes.
    if (disputados.has(a))
      return { ...base, ponto: null, vantagemFrankMs: null, motivo: 'disputado' };
    const googleAntes = google.some(
      (g) => g.t <= a.t && mesmoOuMenor(g.precoCentavos, a.precoCentavos),
    );
    if (googleAntes)
      return { ...base, ponto: null, vantagemFrankMs: null, motivo: 'google_ja_tinha' };
    // O Google ainda nao tinha esse preco: ponto do Frank, mesmo que avise menos depois.
    const googleDepois = google.some((g) => mesmoOuMenor(g.precoCentavos, a.precoCentavos));
    return {
      ...base,
      ponto: 'frank',
      vantagemFrankMs: null,
      motivo: googleDepois ? 'frank_primeiro' : 'so_frank',
    };
  });

  const menorDe = (lista: Aviso[]) =>
    lista.length ? Math.min(...lista.map((a) => a.precoCentavos)) : null;
  return {
    linhas,
    pontos: {
      frank: linhas.filter((l) => l.ponto === 'frank').length,
      google: linhas.filter((l) => l.ponto === 'google').length,
    },
    menor: { frank: menorDe(frank), google: menorDe(google) },
  };
}

/**
 * Data e hora digitadas no painel (horario de Brasilia) -> Date. O Brasil nao tem horario de
 * verao desde 2019: Brasilia e sempre -03:00. Null se a data ou a hora nao existem.
 */
export function instanteDeBrasilia(data: string, hora: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora)) return null;
  const d = new Date(`${data}T${hora}:00-03:00`);
  if (Number.isNaN(d.getTime())) return null;
  // Rejeita 31/02 e afins: o Date "conserta" para outro dia.
  const volta = new Date(d.getTime() - 3 * 3_600_000).toISOString();
  return volta.slice(0, 10) === data && volta.slice(11, 16) === hora ? d : null;
}

/** "1.234,56", "1234,5", "R$ 987" ou "987.50" -> reais. Null se nao for um valor. */
export function lerReais(texto: string): number | null {
  let t = texto.replace(/R\$|\s/gi, '');
  if (!/^\d[\d.,]*$/.test(t)) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** O que a linha significa, em uma frase para a tela. */
export function resultadoDoLance(l: LinhaPlacar): string {
  const v = l.vantagemFrankMs;
  switch (l.motivo) {
    case 'frank_antes':
      return v !== null && v < 60_000
        ? 'O Frank avisou esse preço no mesmo minuto'
        : `O Frank já tinha avisado esse preço ${intervalo(v ?? 0)} antes`;
    case 'frank_depois':
      return `O Frank só avisou esse preço ${intervalo(v ?? 0)} depois`;
    case 'frank_nao_achou':
      return 'O Frank não avisou esse preço';
    case 'so_frank':
      return 'Só o Frank achou esse preço';
    case 'frank_primeiro':
      return 'O Frank avisou esse preço antes do Google';
    case 'google_ja_tinha':
      return 'O Google já tinha avisado um preço igual ou menor';
    case 'disputado':
      return 'Comparado com o alerta do Google';
    case 'repetido':
      return 'Não baixou o menor preço que o Frank já tinha avisado';
  }
}
