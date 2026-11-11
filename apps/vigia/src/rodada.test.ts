import {
  abrirBanco,
  apagarVigilancia,
  type Banco,
  CHAVES_ESTADO,
  criarVigilancia,
  definirAtiva,
  estadoFonte,
  lerEstado,
  obterVigilancia,
  ultimaRodada,
} from '@frank/banco';
import { FonteIndisponivelError } from '@frank/fontes';
import { beforeEach, describe, expect, it } from 'vitest';
import { executarRodada } from './rodada.js';
import { FonteFalsa, itinerario, logEmMemoria, vigilanciaExemplo } from './teste/apoio.js';

const agora = new Date('2026-11-11T12:00:00.000Z');
let db: Banco;

beforeEach(() => {
  db = abrirBanco(':memory:');
});

function deps(fontes: FonteFalsa[], tetoDiarioPorFonte = 300) {
  return { db, fontes, tetoDiarioPorFonte, log: logEmMemoria() };
}

function errosRegistrados() {
  return db.prepare('SELECT erro FROM consultas_fonte WHERE sucesso = 0').all();
}

describe('executarRodada', () => {
  it('consulta cada origem x destino e grava tudo na mesma rodada', async () => {
    const v = criarVigilancia(db, vigilanciaExemplo);
    const fonte = new FonteFalsa('falsa', async (c) => [itinerario(`voo-${c.origem}`, 90_000, c.origem)]);
    const resumo = await executarRodada(deps([fonte]), agora);

    expect(fonte.consultas.map((c) => `${c.origem}-${c.destino}`)).toEqual(['GRU-REC', 'CGH-REC']);
    expect(resumo).toEqual({ vigilancias: 1, consultas: 2, itinerarios: 2, erros: 0, puladasPorTeto: 0 });
    const rodada = ultimaRodada(db, v.id);
    expect(rodada).toHaveLength(2);
    expect(new Set(rodada.map((p) => p.rodada))).toEqual(new Set([agora.toISOString()]));
    expect(obterVigilancia(db, v.id)).toMatchObject({
      ultimaRodadaEm: agora.toISOString(),
      ultimaRodadaResultado: { consultas: 2, itinerarios: 2, erros: 0, puladasPorTeto: 0, ultimoErro: null },
    });
  });

  it('falha numa busca nao impede as outras nem as outras vigilancias', async () => {
    const a = criarVigilancia(db, vigilanciaExemplo);
    const b = criarVigilancia(db, { ...vigilanciaExemplo, origens: ['VCP'], destinos: ['SSA'] });
    const fonte = new FonteFalsa('falsa', async (c) => {
      if (c.origem === 'GRU') throw new FonteIndisponivelError('falsa', 'HTTP 503');
      return [itinerario(`voo-${c.origem}`, 80_000, c.origem)];
    });
    const d = deps([fonte]);
    const resumo = await executarRodada(d, agora);

    expect(resumo.erros).toBe(1);
    expect(ultimaRodada(db, a.id).map((p) => p.idNaFonte)).toEqual(['voo-CGH']);
    expect(ultimaRodada(db, b.id).map((p) => p.idNaFonte)).toEqual(['voo-VCP']);
    expect(errosRegistrados()).toEqual([{ erro: 'FonteIndisponivelError: falsa: HTTP 503' }]);
    // As consultas seguintes deram certo: a fonte nao fica marcada em erro...
    expect(estadoFonte(db, 'falsa').ultimoErro).toBeNull();
    // ...mas a vigilancia mostra que a ultima rodada teve erro.
    expect(obterVigilancia(db, a.id)?.ultimaRodadaResultado).toMatchObject({
      erros: 1,
      ultimoErro: 'falsa GRU→REC: FonteIndisponivelError: falsa: HTTP 503',
    });
    expect(d.log.linhas.some((l) => l.startsWith('aviso falsa GRU→REC'))).toBe(true);
  });

  it('marca a rodada mesmo quando tudo falha, para nao martelar a fonte', async () => {
    const v = criarVigilancia(db, vigilanciaExemplo);
    const fonte = new FonteFalsa('falsa', async () => {
      throw new FonteIndisponivelError('falsa', 'sem resposta');
    });
    await executarRodada(deps([fonte]), agora);
    expect(obterVigilancia(db, v.id)).toMatchObject({
      ultimaRodadaEm: agora.toISOString(),
      ultimaRodadaResultado: { consultas: 2, itinerarios: 0, erros: 2 },
    });

    const outraVez = await executarRodada(deps([fonte]), new Date('2026-11-11T12:01:00.000Z'));
    expect(outraVez.vigilancias).toBe(0);
    expect(fonte.consultas).toHaveLength(2);
  });

  it('teto de 24 h atingido fica visivel para o painel, nao so no log', async () => {
    const v = criarVigilancia(db, vigilanciaExemplo); // 2 buscas por rodada
    const fonte = new FonteFalsa('falsa', async () => [itinerario('x', 1)]);
    const resumo = await executarRodada(deps([fonte], 1), agora);

    expect(resumo).toMatchObject({ consultas: 1, puladasPorTeto: 1 });
    expect(fonte.consultas).toHaveLength(1);
    expect(lerEstado(db, CHAVES_ESTADO.teto('falsa'))).toEqual({ valor: '1', atualizadoEm: agora.toISOString() });
    expect(obterVigilancia(db, v.id)?.ultimaRodadaResultado).toMatchObject({
      puladasPorTeto: 1,
      ultimoErro: 'falsa: teto de 1 consultas em 24 h atingido',
    });
  });

  it('preco em moeda diferente da pedida vira erro registrado, nunca historico calado', async () => {
    const v = criarVigilancia(db, { ...vigilanciaExemplo, origens: ['GRU'] });
    const fonte = new FonteFalsa('falsa', async () => [{ ...itinerario('x', 50_000), moeda: 'EUR' }]);
    const resumo = await executarRodada(deps([fonte]), agora);

    expect(resumo.erros).toBe(1);
    expect(ultimaRodada(db, v.id)).toHaveLength(0);
    expect(estadoFonte(db, 'falsa').ultimoErro).toBe('respondeu em EUR, pedido em BRL');
  });

  it('erro ao gravar e do vigia, nao da fonte', async () => {
    const v = criarVigilancia(db, { ...vigilanciaExemplo, origens: ['GRU'] });
    // A pessoa apaga a vigilancia enquanto a busca acontece.
    const fonte = new FonteFalsa('falsa', async () => {
      apagarVigilancia(db, v.id);
      return [itinerario('x', 1)];
    });
    const d = deps([fonte]);
    const resumo = await executarRodada(d, agora);

    expect(resumo.erros).toBe(1);
    expect(estadoFonte(db, 'falsa').ultimoErro).toBeNull();
    expect(d.log.linhas.some((l) => l.startsWith('erro não consegui gravar os preços de falsa GRU→REC'))).toBe(true);
  });

  it('nao roda vigilancia pausada', async () => {
    const pausada = criarVigilancia(db, vigilanciaExemplo);
    definirAtiva(db, pausada.id, false);
    const fonte = new FonteFalsa('falsa', async () => []);
    expect((await executarRodada(deps([fonte]), agora)).vigilancias).toBe(0);
    expect(fonte.consultas).toHaveLength(0);
  });
});
