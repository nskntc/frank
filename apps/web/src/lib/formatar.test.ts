import { describe, expect, it } from 'vitest';
import { diaComSemana, haQuanto, janela, plural, duracao, horario } from './formatar';

describe('formatar', () => {
  it('dia com o dia da semana', () => {
    expect(diaComSemana('2027-03-12')).toBe('sex 12/03/2027');
    expect(diaComSemana('lixo')).toBe('lixo');
  });

  it('janela de um dia ou de varios', () => {
    expect(janela('2027-03-12', '2027-03-12')).toBe('sex 12/03/2027');
    expect(janela('2027-03-01', '2027-03-31')).toBe('de seg 01/03/2027 a qua 31/03/2027');
  });

  it('ha quanto tempo', () => {
    const agora = new Date('2026-11-11T12:00:00Z');
    expect(haQuanto('2026-11-11T11:55:00Z', agora)).toBe('há 5 min');
    expect(haQuanto('2026-11-11T09:00:00Z', agora)).toBe('há 3 h');
    expect(haQuanto('2026-11-08T12:00:00Z', agora)).toBe('há 3 dias');
  });

  it('plural', () => {
    expect(plural(1, 'adulto', 'adultos')).toBe('1 adulto');
    expect(plural(2, 'adulto', 'adultos')).toBe('2 adultos');
  });
});

describe('horario', () => {
  it('mostra o dia da semana, o dia e a hora local', () => {
    expect(horario('2027-03-12T10:45:00')).toBe('sex 12/03 10:45');
    expect(horario('2027-03-14T00:05')).toBe('dom 14/03 00:05');
  });
  it('devolve o texto como veio se nao for data', () => {
    expect(horario('amanhã')).toBe('amanhã');
  });
});

describe('duracao', () => {
  it('formata horas e minutos', () => {
    expect(duracao(11_100)).toBe('3 h 05 min');
    expect(duracao(3_600)).toBe('1 h');
    expect(duracao(2_700)).toBe('45 min');
  });
});
