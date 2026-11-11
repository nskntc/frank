import { beforeEach, describe, expect, it } from 'vitest';
import { abrirBanco, type Banco } from './abrir.js';
import { menorPrecoJaAvisado, type NovoAlerta, registrarAlerta } from './alertas.js';
import {
  descartarOferta,
  listarOfertas,
  listarOpcoesCompra,
  marcarReconferida,
  menorOfertaAberta,
  obterOferta,
  registrarOferta,
  salvarAvaliacao,
  salvarOpcoesCompra,
} from './ofertas.js';
import { registrarPrecosVistos } from './precos.js';
import { instante, itinerarioExemplo, vigilanciaExemplo } from './teste/dados.js';
import { criarVigilancia } from './vigilancias.js';

let db: Banco;
let vigilanciaId: string;
let precoVistoId: number;

beforeEach(() => {
  db = abrirBanco(':memory:');
  vigilanciaId = criarVigilancia(db, vigilanciaExemplo).id;
  precoVistoId = registrarPrecosVistos(db, vigilanciaId, 'r1', [itinerarioExemplo('a', 70_000)])[0] as number;
});

function novaOferta(precoFinalCentavos: number) {
  return registrarOferta(
    db,
    {
      vigilanciaId,
      precoVistoId,
      precoFinalCentavos,
      moeda: 'BRL',
      precoNormalCentavos: 109_000,
      percentualAbaixo: 36,
      motivos: ['abaixo_do_alvo', 'abaixo_do_normal'],
    },
    instante('2026-11-11T12:00:00.000Z'),
  );
}

describe('ofertas', () => {
  it('nasce detectada e le de volta', () => {
    expect(novaOferta(70_000)).toMatchObject({
      status: 'detectada',
      precoFinalCentavos: 70_000,
      moeda: 'BRL',
      motivos: ['abaixo_do_alvo', 'abaixo_do_normal'],
      avaliacao: null,
      reconferidaEm: null,
    });
  });

  it('guarda a avaliacao do Claude validada', () => {
    const o = novaOferta(70_000);
    const avaliacao = {
      valeAPena: true,
      pegadinhas: [{ tipo: 'outro_aeroporto' as const, descricao: 'Volta por Viracopos.' }],
      resumo: 'Direto, 36% abaixo do normal.',
    };
    salvarAvaliacao(db, o.id, avaliacao);
    expect(obterOferta(db, o.id)).toMatchObject({ status: 'avaliada', avaliacao });
  });

  it('recusa avaliacao fora do schema e marca sem avaliacao quando nao ha', () => {
    const o = novaOferta(70_000);
    expect(() => salvarAvaliacao(db, o.id, { valeAPena: true, pegadinhas: [], resumo: '' })).toThrow();
    salvarAvaliacao(db, o.id, null);
    expect(obterOferta(db, o.id)?.status).toBe('sem_avaliacao');
  });

  it('avaliacao antiga fora do contrato atual vira nula, sem derrubar a lista', () => {
    const o = novaOferta(70_000);
    db.prepare(`UPDATE ofertas SET status = 'avaliada', avaliacao = '{"nota":5}' WHERE id = ?`).run(o.id);
    expect(listarOfertas(db)[0]).toMatchObject({ status: 'avaliada', avaliacao: null });
  });

  it('marca reconferida e esconde as descartadas da lista', () => {
    const barata = novaOferta(65_000);
    const cara = novaOferta(75_000);
    marcarReconferida(db, cara.id, instante('2026-11-11T12:05:00.000Z'));
    expect(obterOferta(db, cara.id)?.reconferidaEm).toBe('2026-11-11T12:05:00.000Z');
    expect(listarOfertas(db).map((o) => o.id)).toEqual([barata.id, cara.id]);
    descartarOferta(db, barata.id);
    expect(listarOfertas(db, { vigilanciaId }).map((o) => o.id)).toEqual([cara.id]);
  });
});

describe('menorOfertaAberta', () => {
  it('lembra a menor oferta aberta do itinerario e ignora as descartadas', () => {
    expect(menorOfertaAberta(db, vigilanciaId, 'kiwi', 'a', 'BRL')).toBeNull();
    const cara = novaOferta(75_000);
    const barata = novaOferta(70_000);
    expect(menorOfertaAberta(db, vigilanciaId, 'kiwi', 'a', 'BRL')).toBe(70_000);
    descartarOferta(db, barata.id);
    expect(menorOfertaAberta(db, vigilanciaId, 'kiwi', 'a', 'BRL')).toBe(75_000);
    descartarOferta(db, cara.id);
    expect(menorOfertaAberta(db, vigilanciaId, 'kiwi', 'a', 'BRL')).toBeNull();
    expect(menorOfertaAberta(db, vigilanciaId, 'kiwi', 'outro', 'BRL')).toBeNull();
  });
});

describe('opcoes de compra', () => {
  it('substitui as opcoes antigas e lista da mais barata para a mais cara', () => {
    const o = novaOferta(70_000);
    salvarOpcoesCompra(db, o.id, [
      { vendedor: 'Antiga', precoCentavos: 1, moeda: 'BRL', estrangeiro: false, link: null },
    ]);
    salvarOpcoesCompra(db, o.id, [
      { vendedor: 'Kiwi.com', precoCentavos: 137_200, moeda: 'BRL', estrangeiro: true, link: null },
      { vendedor: 'LATAM', precoCentavos: 119_500, moeda: 'BRL', estrangeiro: false, link: null },
    ]);
    expect(listarOpcoesCompra(db, o.id).map((x) => [x.vendedor, x.estrangeiro])).toEqual([
      ['LATAM', false],
      ['Kiwi.com', true],
    ]);
  });
});

describe('alertas', () => {
  function alerta(mudanca: Partial<NovoAlerta>): NovoAlerta {
    return {
      vigilanciaId,
      ofertaId: null,
      fonte: 'kiwi',
      idNaFonte: 'a',
      canal: 'telegram',
      precoCentavos: 70_000,
      moeda: 'BRL',
      sucesso: true,
      ...mudanca,
    };
  }

  it('lembra o menor preco ja avisado com sucesso do mesmo itinerario', () => {
    expect(menorPrecoJaAvisado(db, vigilanciaId, 'kiwi', 'a', 'BRL')).toBeNull();
    registrarAlerta(db, alerta({ ofertaId: novaOferta(70_000).id }));
    registrarAlerta(db, alerta({ precoCentavos: 60_000, sucesso: false, erro: 'HTTP 502' }));
    expect(menorPrecoJaAvisado(db, vigilanciaId, 'kiwi', 'a', 'BRL')).toBe(70_000);
    expect(menorPrecoJaAvisado(db, vigilanciaId, 'kiwi', 'outro', 'BRL')).toBeNull();
  });

  it('nao compara precos de moedas diferentes', () => {
    registrarAlerta(db, alerta({ precoCentavos: 20_000, moeda: 'USD' }));
    expect(menorPrecoJaAvisado(db, vigilanciaId, 'kiwi', 'a', 'BRL')).toBeNull();
  });

  it('o alerta continua lembrado mesmo se a oferta for apagada', () => {
    const o = novaOferta(70_000);
    registrarAlerta(db, alerta({ ofertaId: o.id }));
    db.prepare('DELETE FROM ofertas WHERE id = ?').run(o.id);
    expect(menorPrecoJaAvisado(db, vigilanciaId, 'kiwi', 'a', 'BRL')).toBe(70_000);
  });
});
