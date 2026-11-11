const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;

function partes(dia: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** "2027-03-12" -> "sex 12/03/2027". Dia de calendario, sem fuso. */
export function diaComSemana(dia: string): string {
  const p = partes(dia);
  if (!p) return dia;
  const [a, m, d] = p;
  const semana = DIAS.at(new Date(Date.UTC(a, m - 1, d)).getUTCDay());
  return `${semana} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
}

/** Janela de datas: um dia so, ou "de X a Y". */
export function janela(de: string, ate: string): string {
  return de === ate ? diaComSemana(de) : `de ${diaComSemana(de)} a ${diaComSemana(ate)}`;
}

/** "ha 5 min", "ha 3 h", "ha 2 dias" a partir de um instante ISO. */
export function haQuanto(instante: string, agora: Date = new Date()): string {
  const ms = agora.getTime() - Date.parse(instante);
  if (Number.isNaN(ms)) return '';
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

export function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** "2027-03-12T10:45:00" -> "sex 12/03 10:45". Horario local do aeroporto, como a fonte manda. */
export function horario(local: string): string {
  const p = partes(local.slice(0, 10));
  if (!p) return local;
  const [a, m, d] = p;
  const semana = DIAS.at(new Date(Date.UTC(a, m - 1, d)).getUTCDay());
  return `${semana} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} ${local.slice(11, 16)}`;
}

/** 11100 -> "3 h 05 min"; 3600 -> "1 h". */
export function duracao(segundos: number): string {
  const min = Math.round(segundos / 60);
  const h = Math.floor(min / 60);
  const resto = min % 60;
  if (h === 0) return `${resto} min`;
  return resto ? `${h} h ${String(resto).padStart(2, '0')} min` : `${h} h`;
}
