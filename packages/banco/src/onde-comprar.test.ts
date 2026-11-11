import { beforeEach, describe, expect, it } from 'vitest';
import { abrirBanco, type Banco } from './abrir.js';
import {
  CONFIGURACOES,
  ConfiguracaoInvalidaError,
  gravarConfiguracaoNumero,
  lerConfiguracaoNumero,
} from './configuracoes.js';
import { listarOpcoesCompra, registrarOferta, salvarOpcoesCompra } from './ofertas.js';
import { ondeComprarDaOferta } from './onde-comprar.js';
import { registrarPrecosVistos } from './precos.js';
import { instante, itinerarioExemplo, vigilanciaExemplo } from './teste/dados.js';
import { criarVigilancia } from './vigilancias.js';

let db: Banco;
beforeEach(() => {
  db = abrirBanco(':memory:');
});

const tolerancia = CONFIGURACOES.toleranciaCompanhiaPct;

describe('configuracoes', () => {
  it('sem valor gravado, vale o padrao', () => {
    expect(lerConfiguracaoNumero(db, tolerancia)).toBe(5);
  });

  it('grava, le e recusa fora da faixa', () => {
    gravarConfiguracaoNumero(db, tolerancia, 8);
    expect(lerConfiguracaoNumero(db, tolerancia)).toBe(8);
    expect(() => gravarConfiguracaoNumero(db, tolerancia, 80)).toThrow(ConfiguracaoInvalidaError);
  });

  it.each(['muito', '', '   '])('valor estranho no banco (%j) volta ao padrao', (valor) => {
    db.prepare(`INSERT INTO configuracoes VALUES ('tolerancia_companhia_pct', ?, 'x')`).run(valor);
    expect(lerConfiguracaoNumero(db, tolerancia)).toBe(5);
  });
});

describe('ondeComprarDaOferta', () => {
  function ofertaComOpcoes(voltaPara = 'CGH') {
    const v = criarVigilancia(db, { ...vigilanciaExemplo, adultos: 1 });
    // itinerarioExemplo: CGH -> REC em 2027-03-12, so ida
    const idaEVolta = {
      ...itinerarioExemplo('a', 108_300),
      volta: { ...itinerarioExemplo('a', 1).ida, de: 'REC', para: voltaPara, partida: '2027-03-19T17:20:00', chegada: '2027-03-19T20:35:00' },
    };
    const precoVistoId = registrarPrecosVistos(db, v.id, 'r1', [idaEVolta])[0] as number;
    const oferta = registrarOferta(db, {
      vigilanciaId: v.id,
      precoVistoId,
      precoFinalCentavos: 112_091,
      moeda: 'BRL',
      precoNormalCentavos: null,
      percentualAbaixo: null,
      motivos: ['abaixo_do_alvo'],
    });
    salvarOpcoesCompra(db, oferta.id, [
      { vendedor: 'Kiwi.com', precoCentavos: 108_300, moeda: 'BRL', estrangeiro: true, link: 'https://www.kiwi.com/u/a' },
      { vendedor: 'Azul', precoCentavos: 108_300, moeda: 'BRL', estrangeiro: false, ehCompanhia: true, link: null },
      { vendedor: 'Decolar', precoCentavos: 103_600, moeda: 'BRL', estrangeiro: false, link: null },
    ]);
    return oferta;
  }

  it('guarda e le se o vendedor e a companhia', () => {
    const oferta = ofertaComOpcoes();
    expect(listarOpcoesCompra(db, oferta.id).map((o) => [o.vendedor, o.ehCompanhia])).toEqual([
      ['Decolar', false],
      ['Kiwi.com', false],
      ['Azul', true],
    ]);
  });

  it('monta a lista com a tolerancia gravada, os links e as 24 h', () => {
    const oferta = ofertaComOpcoes();
    const r = ondeComprarDaOferta(db, oferta.id, instante('2026-11-11T12:00:00Z'));
    expect(r?.itens[r.destacado]?.vendedor).toBe('Azul'); // 4,5% acima da Decolar, tolerancia 5%
    const azul = r?.itens.find((i) => i.vendedor === 'Azul');
    expect(azul?.etiquetas).toEqual(['24h_para_desistir']);
    expect(azul?.link).toContain('voeazul.com.br');
    expect(r?.itens.find((i) => i.vendedor === 'Decolar')?.link).toContain('/roundtrip/CGH/REC/2027-03-12/2027-03-19/1/0/0');

    gravarConfiguracaoNumero(db, tolerancia, 2);
    expect(ondeComprarDaOferta(db, oferta.id)?.itens[0]?.vendedor).toBe('Decolar');
    const r2 = ondeComprarDaOferta(db, oferta.id);
    expect(r2?.itens[r2.destacado]?.vendedor).toBe('Decolar');
  });

  it('volta por outro aeroporto: nada de link de busca (abriria outra viagem)', () => {
    const oferta = ofertaComOpcoes('VCP');
    const r = ondeComprarDaOferta(db, oferta.id, instante('2026-11-11T12:00:00Z'));
    expect(r?.itens.find((i) => i.vendedor === 'Azul')?.link).toBeNull();
    expect(r?.itens.find((i) => i.vendedor === 'Kiwi.com')?.link).toBe('https://www.kiwi.com/u/a');
  });

  it('exatamente 7 dias, as 22h em Brasilia: as 24 h ainda valem', () => {
    const oferta = ofertaComOpcoes();
    // 2027-03-05 22:00 em Brasilia = 2027-03-06 01:00 UTC; voo em 2027-03-12.
    const r = ondeComprarDaOferta(db, oferta.id, instante('2027-03-06T01:00:00Z'));
    expect(r?.itens.find((i) => i.vendedor === 'Azul')?.etiquetas).toEqual(['24h_para_desistir']);
  });

  it('comprando a menos de 7 dias do voo, sem a etiqueta das 24 h', () => {
    const oferta = ofertaComOpcoes();
    const r = ondeComprarDaOferta(db, oferta.id, instante('2027-03-08T12:00:00Z'));
    expect(r?.itens.find((i) => i.vendedor === 'Azul')?.etiquetas).toEqual([]);
  });

  it('oferta que nao existe', () => {
    expect(ondeComprarDaOferta(db, 999)).toBeNull();
  });
});
