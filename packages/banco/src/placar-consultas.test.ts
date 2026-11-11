import { beforeEach, describe, expect, it } from 'vitest';
import { abrirBanco, type Banco } from './abrir.js';
import { contarChamadasIa, estadoIa, registrarChamadaIa } from './chamadas-ia.js';
import { contarConsultas, estadoFonte, registrarConsulta } from './consultas.js';
import { listarPlacar, type NovoRegistroPlacar, registrarPlacar } from './placar.js';
import { instante, vigilanciaExemplo } from './teste/dados.js';
import { criarVigilancia } from './vigilancias.js';

let db: Banco;
let vigilanciaId: string;
beforeEach(() => {
  db = abrirBanco(':memory:');
  vigilanciaId = criarVigilancia(db, vigilanciaExemplo).id;
});

function registro(mudanca: Partial<NovoRegistroPlacar>): NovoRegistroPlacar {
  return {
    vigilanciaId,
    quem: 'frank',
    vistoEm: instante('2026-11-12T09:00:00Z'),
    precoCentavos: 97_500,
    moeda: 'BRL',
    confirmado: true,
    observacao: null,
    ...mudanca,
  };
}

describe('placar', () => {
  it('ordena pela hora real de chegada, mesmo com horario em outro fuso', () => {
    // 08:30 em Brasilia = 11:30 UTC, depois das 09:00 UTC do Frank.
    registrarPlacar(db, registro({ quem: 'google', vistoEm: new Date('2026-11-12T08:30:00-03:00') }));
    registrarPlacar(db, registro({ quem: 'frank', vistoEm: instante('2026-11-12T09:00:00Z') }));
    expect(listarPlacar(db, vigilanciaId).map((r) => [r.quem, r.vistoEm])).toEqual([
      ['frank', '2026-11-12T09:00:00.000Z'],
      ['google', '2026-11-12T11:30:00.000Z'],
    ]);
  });

  it('recusa competidor desconhecido e data invalida', () => {
    expect(() => registrarPlacar(db, registro({ quem: 'kayak' as 'google' }))).toThrow();
    expect(() => registrarPlacar(db, registro({ vistoEm: new Date('ontem') }))).toThrow(RangeError);
  });
});

describe('chamadas ao Claude', () => {
  it('conta as chamadas do periodo e mostra o ultimo erro', () => {
    registrarChamadaIa(db, { tarefa: 'avaliar_oferta', sucesso: true, duracaoMs: 900 }, instante('2026-11-10T08:00:00Z'));
    registrarChamadaIa(db, { tarefa: 'planejar', sucesso: true }, instante('2026-11-11T08:00:00Z'));
    registrarChamadaIa(db, { tarefa: 'planejar', sucesso: false, erro: 'limite do plano' }, instante('2026-11-11T09:00:00Z'));
    expect(contarChamadasIa(db, instante('2026-11-11T00:00:00Z'))).toBe(2);
    expect(estadoIa(db)).toEqual({
      ultimaChamada: '2026-11-11T09:00:00.000Z',
      ultimoSucesso: '2026-11-11T08:00:00.000Z',
      ultimoErro: 'limite do plano',
    });
  });
});

describe('consultas as fontes', () => {
  it('conta as consultas desde um instante', () => {
    registrarConsulta(db, 'kiwi', { sucesso: true }, instante('2026-11-10T23:00:00Z'));
    registrarConsulta(db, 'kiwi', { sucesso: true }, instante('2026-11-11T08:00:00Z'));
    registrarConsulta(db, 'serpapi', { sucesso: true }, instante('2026-11-11T08:00:00Z'));
    expect(contarConsultas(db, 'kiwi', instante('2026-11-11T00:00:00Z'))).toBe(1);
  });

  it('mostra o ultimo erro e o ultimo sucesso da fonte', () => {
    expect(estadoFonte(db, 'kiwi')).toEqual({
      fonte: 'kiwi',
      ultimaConsulta: null,
      ultimoSucesso: null,
      ultimoErro: null,
    });
    registrarConsulta(db, 'kiwi', { sucesso: true }, instante('2026-11-11T08:00:00Z'));
    registrarConsulta(db, 'kiwi', { sucesso: false, erro: 'HTTP 503' }, instante('2026-11-11T09:00:00Z'));
    expect(estadoFonte(db, 'kiwi')).toEqual({
      fonte: 'kiwi',
      ultimaConsulta: '2026-11-11T09:00:00.000Z',
      ultimoSucesso: '2026-11-11T08:00:00.000Z',
      ultimoErro: 'HTTP 503',
    });
  });
});
