import { abrirBanco, type Banco, criarVigilancia, pedirChecagem, ultimaRodada } from '@frank/banco';
import type { Itinerario, Vigilancia } from '@frank/contratos';
import { FonteIndisponivelError } from '@frank/fontes';
import { beforeEach, describe, expect, it } from 'vitest';
import { diasDaBusca, intervaloGoogleMinutos } from './busca-google.js';
import { executarRodada } from './rodada.js';
import { FonteFalsa, itinerario, logEmMemoria, vigilanciaExemplo } from './teste/apoio.js';

let db: Banco;
beforeEach(() => {
  db = abrirBanco(':memory:');
});

const t = (iso: string) => new Date(iso);

/** Google falso: busca um dia por vez, como o de verdade. */
class GoogleFalso extends FonteFalsa {
  readonly umDiaPorBusca = true;
}

const doGoogle = (id: string, preco: number): Itinerario => ({
  ...itinerario(id, preco),
  fonte: 'google',
});

function deps(kiwi: FonteFalsa, google: FonteFalsa | undefined, porDia = 6) {
  return {
    db,
    fontes: [kiwi],
    tetoDiarioPorFonte: 300,
    log: logEmMemoria(),
    ...(google ? { google, buscasGooglePorDia: porDia } : {}),
  };
}

const kiwiVazia = () => new FonteFalsa('kiwi', async () => []);

describe('diasDaBusca', () => {
  const v = {
    ...vigilanciaExemplo,
    idaDe: '2027-02-01',
    idaAte: '2027-02-03',
    voltaDe: '2027-02-08',
    voltaAte: '2027-02-12',
  } as Vigilancia;

  it('a ida gira pela janela; a volta fica a mesma distancia, dentro da janela', () => {
    expect(diasDaBusca(v, 0)).toEqual({ ida: '2027-02-01', volta: '2027-02-08' });
    expect(diasDaBusca(v, 1)).toEqual({ ida: '2027-02-02', volta: '2027-02-09' });
    expect(diasDaBusca(v, 3)).toEqual({ ida: '2027-02-01', volta: '2027-02-08' });
  });

  it('com estadia, a volta e o meio da estadia, cortada pela janela', () => {
    const e = { ...v, estadia: { minNoites: 10, maxNoites: 14 } } as Vigilancia;
    expect(diasDaBusca(e, 0)).toEqual({ ida: '2027-02-01', volta: '2027-02-12' });
  });

  it('so ida nao tem volta', () => {
    expect(diasDaBusca({ ...v, voltaDe: null, voltaAte: null }, 2).volta).toBeNull();
  });
});

describe('intervaloGoogleMinutos', () => {
  it('espaca as rotas para caber na cota do dia; nunca menos que o intervalo da rota', () => {
    const idaEVolta = { ...vigilanciaExemplo, intervaloMinutos: 60 } as Vigilancia;
    const soIda = { ...idaEVolta, voltaDe: null, voltaAte: null } as Vigilancia;
    const comMala = { ...idaEVolta, malasDespachadas: 1 } as Vigilancia;
    // 2 + 1 consultas por volta completa, 6 por dia: cada rota a cada 12 h. Com mala nao conta.
    expect(intervaloGoogleMinutos(idaEVolta, [idaEVolta, soIda, comMala], 6)).toBe(720);
    expect(intervaloGoogleMinutos(idaEVolta, [idaEVolta], 100)).toBe(60);
  });
});

describe('busca no Google na rodada (issue #27)', () => {
  it('rota em que a Kiwi nao acha nada passa a ter os voos do Google, na mesma rodada', async () => {
    const v = criarVigilancia(
      db,
      { ...vigilanciaExemplo, voltaDe: null, voltaAte: null },
      t('2026-11-18T11:00:00Z'),
    );
    const google = new GoogleFalso('google', async () => [doGoogle('g1', 250_000)]);
    const resumo = await executarRodada(deps(kiwiVazia(), google), t('2026-11-18T12:00:00Z'));

    expect(resumo.itinerarios).toBe(1);
    expect(google.consultas).toHaveLength(1);
    // Todos os aeroportos numa busca so, no primeiro dia da janela.
    expect(google.consultas[0]).toMatchObject({
      origem: 'GRU,CGH',
      destino: 'REC',
      ida: '2027-03-12',
    });
    expect(ultimaRodada(db, v.id).map((p) => `${p.fonte}:${p.idNaFonte}`)).toEqual(['google:g1']);
  });

  it('respeita o espacamento; "Checar agora" busca ja', async () => {
    const v = criarVigilancia(db, vigilanciaExemplo, t('2026-11-18T11:00:00Z'));
    const google = new GoogleFalso('google', async () => [doGoogle('g1', 250_000)]);
    const kiwi = new FonteFalsa('kiwi', async (c) => [
      itinerario(`k-${c.origem}`, 300_000, c.origem),
    ]);
    await executarRodada(deps(kiwi, google), t('2026-11-18T12:00:00Z'));
    expect(google.consultas).toHaveLength(1);

    // 1 h depois a Kiwi roda de novo; o Google (1 rota de 2 consultas, 6 por dia) so em 8 h.
    await executarRodada(deps(kiwi, google), t('2026-11-18T13:00:00Z'));
    expect(google.consultas).toHaveLength(1);

    pedirChecagem(db, v.id, t('2026-11-18T13:10:00Z'));
    await executarRodada(deps(kiwi, google), t('2026-11-18T13:11:00Z'));
    expect(google.consultas).toHaveLength(2);
    // A segunda busca vai para o proximo dia da janela (aqui a janela tem 1 dia: o mesmo).
    expect(google.consultas[1]?.ida).toBe('2027-03-12');
  });

  it('rota com mala despachada fica so com a Kiwi (o Google nao da o preco com mala)', async () => {
    criarVigilancia(db, { ...vigilanciaExemplo, malasDespachadas: 1 }, t('2026-11-18T11:00:00Z'));
    const google = new GoogleFalso('google', async () => [doGoogle('g1', 250_000)]);
    await executarRodada(deps(kiwiVazia(), google), t('2026-11-18T12:00:00Z'));
    expect(google.consultas).toHaveLength(0);
  });

  it('falha do Google vai para o log e nao vira erro da rodada', async () => {
    criarVigilancia(db, vigilanciaExemplo, t('2026-11-18T11:00:00Z'));
    const google = new GoogleFalso('google', async () => {
      throw new FonteIndisponivelError('google', 'HTTP 500');
    });
    const kiwi = new FonteFalsa('kiwi', async (c) => [
      itinerario(`k-${c.origem}`, 300_000, c.origem),
    ]);
    const d = deps(kiwi, google);
    const resumo = await executarRodada(d, t('2026-11-18T12:00:00Z'));
    expect(resumo.erros).toBe(0);
    expect(
      d.log.linhas.some((l) => l.includes('google GRU,CGH→REC') && l.includes('HTTP 500')),
    ).toBe(true);
  });

  it('oferta vinda do Google e reconferida no Google, nos dias do proprio voo', async () => {
    criarVigilancia(
      db,
      {
        ...vigilanciaExemplo,
        voltaDe: null,
        voltaAte: null,
        idaAte: '2027-03-20',
        precoAlvoCentavos: 300_000,
      },
      t('2026-11-18T11:00:00Z'),
    );
    const google = new GoogleFalso('google', async () => [doGoogle('g1', 200_000)]);
    const resumo = await executarRodada(deps(kiwiVazia(), google), t('2026-11-18T12:00:00Z'));
    expect(resumo.ofertas).toBe(1);
    expect(google.consultas).toHaveLength(2);
    const reconferencia = google.consultas[1];
    expect(reconferencia).toMatchObject({
      origem: 'GRU',
      destino: 'REC',
      ida: '2027-03-12',
      companhias: ['AD'],
    });
    expect(reconferencia?.idaAte).toBeUndefined();
  });
});
