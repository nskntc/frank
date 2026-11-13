import {
  abrirBanco,
  apagarVigilancia,
  type Banco,
  CHAVES_ESTADO,
  criarVigilancia,
  definirAtiva,
  estadoFonte,
  lerEstado,
  obterRodizio,
  obterVigilancia,
  registrarConsulta,
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
    const fonte = new FonteFalsa('falsa', async (c) => [
      itinerario(`voo-${c.origem}`, 90_000, c.origem),
    ]);
    const resumo = await executarRodada(deps([fonte]), agora);

    expect(fonte.consultas.map((c) => `${c.origem}-${c.destino}`)).toEqual(['GRU-REC', 'CGH-REC']);
    expect(resumo).toEqual({
      vigilancias: 1,
      consultas: 2,
      itinerarios: 2,
      erros: 0,
      puladasPorTeto: 0,
      ofertas: 0,
    });
    const rodada = ultimaRodada(db, v.id);
    expect(rodada).toHaveLength(2);
    expect(new Set(rodada.map((p) => p.rodada))).toEqual(new Set([agora.toISOString()]));
    expect(obterVigilancia(db, v.id)).toMatchObject({
      ultimaRodadaEm: agora.toISOString(),
      ultimaRodadaResultado: {
        consultas: 2,
        itinerarios: 2,
        erros: 0,
        puladasPorTeto: 0,
        ultimoErro: null,
      },
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

    // Uma tentativa extra em 10 min (issue #23); falhando de novo, so no intervalo normal.
    expect(
      (await executarRodada(deps([fonte]), new Date('2026-11-11T12:10:00.000Z'))).vigilancias,
    ).toBe(1);
    expect(obterVigilancia(db, v.id)?.ultimaRodadaResultado?.repeticao).toBe(true);
    expect(
      (await executarRodada(deps([fonte]), new Date('2026-11-11T12:20:00.000Z'))).vigilancias,
    ).toBe(0);
    expect(
      (await executarRodada(deps([fonte]), new Date('2026-11-11T13:10:00.000Z'))).vigilancias,
    ).toBe(1);
  });

  it('teto de 24 h atingido fica visivel para o painel, nao so no log', async () => {
    const v = criarVigilancia(db, vigilanciaExemplo); // 2 pares
    // 299 consultas de outras rodadas nas ultimas 24 h: so cabe mais uma.
    for (let i = 0; i < 299; i++)
      registrarConsulta(db, 'falsa', { sucesso: true }, new Date('2026-11-11T08:00:00.000Z'));
    const fonte = new FonteFalsa('falsa', async () => [itinerario('x', 1)]);
    const resumo = await executarRodada(deps([fonte]), agora);

    expect(resumo).toMatchObject({ consultas: 1, puladasPorTeto: 1 });
    expect(fonte.consultas).toHaveLength(1);
    expect(lerEstado(db, CHAVES_ESTADO.teto('falsa'))).toEqual({
      valor: '300',
      atualizadoEm: agora.toISOString(),
    });
    expect(obterVigilancia(db, v.id)?.ultimaRodadaResultado).toMatchObject({
      puladasPorTeto: 1,
      ultimoErro: 'falsa: teto de 300 consultas em 24 h atingido',
    });
    // O par que ficou de fora e o primeiro da proxima rodada, no mesmo ciclo.
    expect(obterRodizio(db, v.id)).toEqual({ ciclo: agora.toISOString(), proximoPar: 1 });
  });

  it('preco em moeda diferente da pedida vira erro registrado, nunca historico calado', async () => {
    const v = criarVigilancia(db, { ...vigilanciaExemplo, origens: ['GRU'] });
    const fonte = new FonteFalsa('falsa', async () => [
      { ...itinerario('x', 50_000), moeda: 'EUR' },
    ]);
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
    expect(
      d.log.linhas.some((l) => l.startsWith('erro não consegui gravar os preços de falsa GRU→REC')),
    ).toBe(true);
  });

  it('nao roda vigilancia pausada', async () => {
    const pausada = criarVigilancia(db, vigilanciaExemplo);
    definirAtiva(db, pausada.id, false);
    const fonte = new FonteFalsa('falsa', async () => []);
    expect((await executarRodada(deps([fonte]), agora)).vigilancias).toBe(0);
    expect(fonte.consultas).toHaveLength(0);
  });
});

describe('rodizio de pares (issue #19)', () => {
  const NORDESTE = {
    ...vigilanciaExemplo,
    origens: ['CNF', 'PLU'],
    destinos: ['REC', 'SSA', 'FOR', 'MCZ', 'NAT'],
  };
  const hora = (h: number) => new Date(agora.getTime() + h * 3_600_000);

  it('aceite: 10 pares de hora em hora cabem no teto e todos sao cobertos ao longo do dia', async () => {
    const v = criarVigilancia(db, NORDESTE);
    const fonte = new FonteFalsa('falsa', async (c) => [
      itinerario(`voo-${c.origem}-${c.destino}`, 90_000, c.origem),
    ]);
    for (let h = 0; h < 24; h++) await executarRodada(deps([fonte]), hora(h));

    // Pior caso planejado: 3 pares x 3 buscas x 24 rodadas = 216, abaixo de 80% do teto.
    expect(fonte.consultas.length).toBeLessThanOrEqual(240);
    const porPar = new Map<string, number>();
    for (const c of fonte.consultas)
      porPar.set(`${c.origem}-${c.destino}`, (porPar.get(`${c.origem}-${c.destino}`) ?? 0) + 1);
    expect(porPar.size).toBe(10);
    for (const n of porPar.values()) expect(n).toBeGreaterThanOrEqual(5);
    expect(obterVigilancia(db, v.id)?.ultimaRodadaResultado?.puladasPorTeto).toBe(0);
  });

  it('as rodadas parciais de um ciclo dividem o mesmo id; o ciclo seguinte comeca outro', async () => {
    const v = criarVigilancia(db, NORDESTE);
    const fonte = new FonteFalsa('falsa', async (c) => [
      itinerario(`voo-${c.origem}-${c.destino}`, 90_000, c.origem),
    ]);
    const pares = () => fonte.consultas.splice(0).map((c) => `${c.origem}-${c.destino}`);

    await executarRodada(deps([fonte]), hora(0));
    expect(pares()).toEqual(['CNF-REC', 'CNF-SSA', 'CNF-FOR']);
    await executarRodada(deps([fonte]), hora(1));
    expect(pares()).toEqual(['CNF-MCZ', 'CNF-NAT', 'PLU-REC']);
    await executarRodada(deps([fonte]), hora(2));
    await executarRodada(deps([fonte]), hora(3));
    expect(pares()).toEqual(['PLU-SSA', 'PLU-FOR', 'PLU-MCZ', 'PLU-NAT']);
    // Ciclo inteiro numa rodada so: o detector e o "mais barato agora" veem os 10 pares.
    expect(ultimaRodada(db, v.id)).toHaveLength(10);
    expect(new Set(ultimaRodada(db, v.id).map((p) => p.rodada))).toEqual(
      new Set([hora(0).toISOString()]),
    );
    expect(obterRodizio(db, v.id)).toBeNull();

    await executarRodada(deps([fonte]), hora(4));
    expect(pares()).toEqual(['CNF-REC', 'CNF-SSA', 'CNF-FOR']);
    expect(ultimaRodada(db, v.id)[0]?.rodada).toBe(hora(4).toISOString());
  });

  it('ciclo velho (vigia desligado por dias) recomeca do primeiro par', async () => {
    const v = criarVigilancia(db, NORDESTE);
    const fonte = new FonteFalsa('falsa', async () => []);
    await executarRodada(deps([fonte]), hora(0));
    fonte.consultas.splice(0);
    await executarRodada(deps([fonte]), hora(72));
    expect(fonte.consultas.map((c) => `${c.origem}-${c.destino}`)).toEqual([
      'CNF-REC',
      'CNF-SSA',
      'CNF-FOR',
    ]);
    expect(obterRodizio(db, v.id)?.ciclo).toBe(hora(72).toISOString());
  });

  it('rota pequena segue consultando tudo em toda rodada', async () => {
    const v = criarVigilancia(db, vigilanciaExemplo);
    const fonte = new FonteFalsa('falsa', async () => []);
    await executarRodada(deps([fonte]), hora(0));
    await executarRodada(deps([fonte]), hora(1));
    expect(fonte.consultas).toHaveLength(4);
    expect(obterRodizio(db, v.id)).toBeNull();
  });
});

describe('filtros de horario e duracao (issue #21)', () => {
  it('so grava o voo que cabe; conta os que ficaram de fora', async () => {
    const v = criarVigilancia(db, {
      ...vigilanciaExemplo,
      origens: ['GRU'],
      filtros: {
        duracaoMaximaHoras: null,
        idaPartidaApos: null,
        idaChegadaAte: '17:00',
        voltaPartidaApos: null,
        voltaChegadaAte: null,
      },
    });
    const tarde = itinerario('tarde', 50_000);
    const cedo = itinerario('cedo', 90_000);
    tarde.ida = { ...tarde.ida, chegada: '2026-12-01T22:10:00' };
    cedo.ida = { ...cedo.ida, chegada: '2026-12-01T16:40:00' };
    const fonte = new FonteFalsa('falsa', async () => [tarde, cedo]);
    await executarRodada(deps([fonte]), agora);

    expect(ultimaRodada(db, v.id).map((p) => p.idNaFonte)).toEqual(['cedo']);
    expect(obterVigilancia(db, v.id)?.ultimaRodadaResultado).toMatchObject({
      itinerarios: 1,
      foraDosFiltros: 1,
      erros: 0,
    });
  });
});
