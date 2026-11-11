import {
  abrirBanco,
  type Banco,
  criarVigilancia,
  listarOfertas,
  registrarPrecosVistos,
} from '@frank/banco';
import type { NovaVigilancia } from '@frank/contratos';
import { FonteIndisponivelError } from '@frank/fontes';
import { beforeEach, describe, expect, it } from 'vitest';
import { executarRodada } from './rodada.js';
import { FonteFalsa, itinerario, logEmMemoria, vigilanciaExemplo } from './teste/apoio.js';

const t0 = new Date('2026-11-11T12:00:00.000Z');
const minutos = (m: number) => new Date(t0.getTime() + m * 60_000);
let db: Banco;

beforeEach(() => {
  db = abrirBanco(':memory:');
});

/**
 * Mercado falso: `precos` diz quanto custa cada voo agora. A fonte respeita o filtro de
 * companhias (a reconferencia busca so a companhia do voo).
 */
function mercado(precos: Record<string, number>, opcoes: { estrangeiro?: boolean } = {}) {
  const estado = { precos, falhar: false };
  const fonte = new FonteFalsa(
    'falsa',
    async (c) => {
      if (estado.falhar) throw new FonteIndisponivelError('falsa', 'HTTP 503');
      return Object.entries(estado.precos)
        .map(([id, preco]) => itinerario(id, preco, 'GRU', id.split('-')[0]))
        .filter((it) => !c.companhias?.length || c.companhias.includes(it.ida.trechos[0]?.codigoCompanhia ?? ''));
    },
    undefined,
    opcoes.estrangeiro,
  );
  return { fonte, estado };
}

function vigilancia(mudanca: Partial<NovaVigilancia> = {}) {
  return criarVigilancia(db, { ...vigilanciaExemplo, origens: ['GRU'], ...mudanca }, new Date('2026-10-01T00:00:00Z'));
}

async function rodar(fonte: FonteFalsa, agora = t0) {
  const log = logEmMemoria();
  const resumo = await executarRodada({ db, fontes: [fonte], tetoDiarioPorFonte: 300, log }, agora);
  return { resumo, log };
}

/** 20 rodadas antigas (dentro dos 14 dias) com o voo a R$ 1.090. */
function historicoNormal(vigilanciaId: string, rodadas = 20) {
  for (let i = 0; i < rodadas; i++) {
    const quando = new Date(t0.getTime() - (i + 1) * 3_600_000);
    registrarPrecosVistos(db, vigilanciaId, `antiga-${i}`, [itinerario('AD-1', 109_000)], quando);
  }
}

describe('detector no ciclo (RF-07 a RF-09)', () => {
  it('sem historico e sem preco-alvo, nada vira oferta', async () => {
    vigilancia();
    const { fonte } = mercado({ 'AD-1': 50_000 });
    const { resumo } = await rodar(fonte);
    expect(resumo.ofertas).toBe(0);
    expect(fonte.consultas).toHaveLength(1);
  });

  it('preco-alvo atingido: reconfere so a companhia do voo e cria a oferta', async () => {
    const v = vigilancia({ precoAlvoCentavos: 80_000 });
    const { fonte } = mercado({ 'AD-1': 79_000, 'LA-1': 95_000 });
    const { resumo, log } = await rodar(fonte);

    expect(resumo.ofertas).toBe(1);
    expect(fonte.consultas[1]?.companhias).toEqual(['AD']);
    const [oferta] = listarOfertas(db, { vigilanciaId: v.id });
    expect(oferta).toMatchObject({
      status: 'detectada',
      precoFinalCentavos: 79_000,
      motivos: ['abaixo_do_alvo'],
      reconferidaEm: t0.toISOString(),
    });
    expect(log.linhas.some((l) => l.startsWith('info oferta:') && l.includes('R$ 790,00'))).toBe(true);
  });

  it('vendedor estrangeiro: o IOF entra antes de comparar com o alvo', async () => {
    vigilancia({ precoAlvoCentavos: 80_000 });
    // R$ 780 + 3,5% = R$ 807,30: passa do alvo.
    const caro = mercado({ 'AD-1': 78_000 }, { estrangeiro: true });
    expect((await rodar(caro.fonte)).resumo.ofertas).toBe(0);

    // R$ 770 + 3,5% = R$ 796,95: dentro do alvo.
    caro.estado.precos = { 'AD-1': 77_000 };
    const { resumo } = await rodar(caro.fonte, minutos(61));
    expect(resumo.ofertas).toBe(1);
    expect(listarOfertas(db)[0]?.precoFinalCentavos).toBe(79_695);
  });

  it('25% ou mais abaixo do normal vira oferta, com o normal gravado', async () => {
    const v = vigilancia();
    historicoNormal(v.id);
    const { fonte } = mercado({ 'AD-1': 80_000 });
    const { resumo } = await rodar(fonte);

    expect(resumo.ofertas).toBe(1);
    expect(listarOfertas(db)[0]).toMatchObject({
      motivos: ['abaixo_do_normal'],
      precoNormalCentavos: 109_000,
      percentualAbaixo: 27,
    });
  });

  it('com menos de 20 rodadas de historico, o normal ainda nao vale', async () => {
    const v = vigilancia();
    historicoNormal(v.id, 19);
    const { fonte } = mercado({ 'AD-1': 50_000 });
    expect((await rodar(fonte)).resumo.ofertas).toBe(0);
  });

  it('preco subiu na reconferencia: nao vira oferta', async () => {
    vigilancia({ precoAlvoCentavos: 80_000 });
    const m = mercado({ 'AD-1': 79_000 });
    let chamadas = 0;
    const fonte = new FonteFalsa('falsa', async (c) => {
      chamadas++;
      return chamadas === 1 ? m.fonte.buscar(c) : [itinerario('AD-1', 85_000)];
    });
    const { resumo, log } = await rodar(fonte);
    expect(resumo.ofertas).toBe(0);
    expect(log.linhas.some((l) => l.includes('não se confirmou: o preço subiu'))).toBe(true);
  });

  it('voo sumiu na reconferencia: nao vira oferta', async () => {
    vigilancia({ precoAlvoCentavos: 80_000 });
    let chamadas = 0;
    const fonte = new FonteFalsa('falsa', async () => (++chamadas === 1 ? [itinerario('AD-1', 79_000)] : []));
    const { resumo, log } = await rodar(fonte);
    expect(resumo.ofertas).toBe(0);
    expect(log.linhas.some((l) => l.includes('o voo sumiu'))).toBe(true);
  });

  it('erro na reconferencia: nao vira oferta e o erro fica na rodada', async () => {
    vigilancia({ precoAlvoCentavos: 80_000 });
    let chamadas = 0;
    const fonte = new FonteFalsa('falsa', async () => {
      if (++chamadas === 1) return [itinerario('AD-1', 79_000)];
      throw new FonteIndisponivelError('falsa', 'HTTP 503');
    });
    const { resumo } = await rodar(fonte);
    expect(resumo).toMatchObject({ ofertas: 0, erros: 1 });
  });

  it('caiu na rodada mas subiu na reconferencia, com oferta aberta mais barata: nao duplica', async () => {
    vigilancia({ precoAlvoCentavos: 80_000 });
    const m = mercado({ 'AD-1': 79_000 });
    expect((await rodar(m.fonte, t0)).resumo.ofertas).toBe(1);

    let chamadas = 0;
    const oscila = new FonteFalsa('falsa', async () =>
      ++chamadas === 1 ? [itinerario('AD-1', 75_000)] : [itinerario('AD-1', 80_000)],
    );
    expect((await rodar(oscila, minutos(61))).resumo.ofertas).toBe(0);
    expect(listarOfertas(db).map((o) => o.precoFinalCentavos)).toEqual([79_000]);
  });

  it('nao repete a oferta a cada hora; so cria outra se o preco cair mais', async () => {
    vigilancia({ precoAlvoCentavos: 80_000 });
    const m = mercado({ 'AD-1': 79_000 });
    expect((await rodar(m.fonte, t0)).resumo.ofertas).toBe(1);
    expect((await rodar(m.fonte, minutos(61))).resumo.ofertas).toBe(0);
    m.estado.precos = { 'AD-1': 75_000 };
    expect((await rodar(m.fonte, minutos(122))).resumo.ofertas).toBe(1);
    expect(listarOfertas(db).map((o) => o.precoFinalCentavos)).toEqual([75_000, 79_000]);
  });
});
