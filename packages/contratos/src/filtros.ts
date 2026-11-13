import { z } from 'zod';
import type { Itinerario, Perna } from './itinerario.js';

/** Hora do dia HH:MM, 00:00 a 23:59. */
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'hora invalida, use HH:MM' });

/**
 * Preferencias de horario e duracao da vigilancia (issue #21). Todos opcionais (null = tanto faz).
 * Horarios sao do relogio local de cada aeroporto, como a fonte informa e como a pessoa le no
 * cartao de embarque. Comparam so a hora do dia: chegar 16:00 no dia seguinte "cabe" no "ate
 * 17h"; quem quer evitar viagem longa usa a duracao maxima.
 */
export const filtrosSchema = z
  .object({
    /** Duracao maxima de cada trecho (ida, e volta separada), em horas, com as conexoes. */
    duracaoMaximaHoras: z.number().int().min(1).max(72).nullable(),
    idaPartidaApos: hora.nullable(),
    idaChegadaAte: hora.nullable(),
    voltaPartidaApos: hora.nullable(),
    voltaChegadaAte: hora.nullable(),
  })
  .strict();

export type Filtros = z.infer<typeof filtrosSchema>;

export const SEM_FILTROS: Filtros = {
  duracaoMaximaHoras: null,
  idaPartidaApos: null,
  idaChegadaAte: null,
  voltaPartidaApos: null,
  voltaChegadaAte: null,
};

/** Algum filtro ligado? Filtros com tudo null equivalem a nenhum. */
export function temFiltros(f: Filtros | null | undefined): f is Filtros {
  return !!f && Object.values(f).some((x) => x !== null);
}

/** "2027-02-01T16:40:00" -> "16:40". */
function horaDoDia(horarioLocal: string): string {
  return horarioLocal.slice(11, 16);
}

function pernaCabe(
  p: Perna,
  partidaApos: string | null,
  chegadaAte: string | null,
  duracaoMaximaHoras: number | null,
): boolean {
  if (partidaApos !== null && horaDoDia(p.partida) < partidaApos) return false;
  if (chegadaAte !== null && horaDoDia(p.chegada) > chegadaAte) return false;
  if (duracaoMaximaHoras !== null && p.duracaoSegundos > duracaoMaximaHoras * 3600) return false;
  return true;
}

/** O voo atende as preferencias? Sem filtros, sempre. */
export function cabeNosFiltros(it: Itinerario, f: Filtros | null | undefined): boolean {
  if (!temFiltros(f)) return true;
  if (!pernaCabe(it.ida, f.idaPartidaApos, f.idaChegadaAte, f.duracaoMaximaHoras)) return false;
  return (
    it.volta === null ||
    pernaCabe(it.volta, f.voltaPartidaApos, f.voltaChegadaAte, f.duracaoMaximaHoras)
  );
}

/** Texto curto para o painel: "trechos de até 12 h · ida chegando até 17:00 · volta saindo depois das 14:00". */
export function descreverFiltros(f: Filtros | null | undefined): string | null {
  if (!temFiltros(f)) return null;
  const partes: string[] = [];
  if (f.duracaoMaximaHoras !== null) partes.push(`trechos de até ${f.duracaoMaximaHoras} h`);
  const lado = (nome: string, apos: string | null, ate: string | null) => {
    const coisas = [
      apos !== null ? `saindo depois das ${apos}` : null,
      ate !== null ? `chegando até ${ate}` : null,
    ].filter(Boolean);
    if (coisas.length) partes.push(`${nome} ${coisas.join(' e ')}`);
  };
  lado('ida', f.idaPartidaApos, f.idaChegadaAte);
  lado('volta', f.voltaPartidaApos, f.voltaChegadaAte);
  return partes.join(' · ');
}
