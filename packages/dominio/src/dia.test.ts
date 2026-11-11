import { describe, expect, it } from 'vitest';
import { DiaInvalidoError, diaNoFuso, diasEntre, lerDia } from './dia.js';

describe('lerDia', () => {
  it('aceita um dia de calendario valido', () => {
    expect(lerDia('2027-03-12')).toBe('2027-03-12');
  });

  it.each(['2026-02-30', '2026-13-01', '12/03/2027', '2027-03-12T10:00', '9999-01-01', ''])(
    'recusa %s',
    (valor) => {
      expect(() => lerDia(valor)).toThrow(DiaInvalidoError);
    },
  );
});

describe('diaNoFuso', () => {
  it('22h em Brasilia ainda e o mesmo dia, mesmo ja sendo o seguinte em UTC', () => {
    expect(diaNoFuso(new Date('2027-03-06T01:00:00Z'))).toBe('2027-03-05');
  });

  it('respeita outro fuso', () => {
    expect(diaNoFuso(new Date('2027-03-06T01:00:00Z'), 'UTC')).toBe('2027-03-06');
  });
});

describe('diasEntre', () => {
  it('conta os dias entre duas datas', () => {
    expect(diasEntre(lerDia('2027-03-05'), lerDia('2027-03-12'))).toBe(7);
  });

  it('atravessa a virada do ano', () => {
    expect(diasEntre(lerDia('2026-12-30'), lerDia('2027-01-02'))).toBe(3);
  });

  it('fica negativo quando a segunda data vem antes', () => {
    expect(diasEntre(lerDia('2027-03-12'), lerDia('2027-03-10'))).toBe(-2);
  });
});
