import {
  abrirBanco,
  type Banco,
  CHAVES_ESTADO,
  criarVigilancia,
  gravarEstado,
  marcarRodada,
} from '@frank/banco';
import { beforeEach, describe, expect, it } from 'vitest';
import { limiteVigiaParadoMs, montarStatus } from './status';
import { EXEMPLOS } from './teste/exemplo';

const AGORA = new Date('2027-01-20T15:00:00Z');
const antes = (min: number) => new Date(AGORA.getTime() - min * 60_000);
// Canais "preenchidos" com valores ficticios: o status so olha se existem.
const ENV_COM_EMAIL = {
  SMTP_HOST: 'x',
  SMTP_USUARIO: 'x',
  SMTP_SENHA: 'x',
  ALERTA_EMAIL_PARA: 'x',
};

let db: Banco;
beforeEach(() => {
  db = abrirBanco(':memory:');
});

const ids = (s: ReturnType<typeof montarStatus>) => s.problemas.map((p) => p.id);

describe('montarStatus', () => {
  it('vigia que nunca rodou', () => {
    expect(montarStatus(db, ENV_COM_EMAIL, AGORA).vigia).toEqual({
      estado: 'nunca',
      vistoEm: null,
    });
  });

  it('ligado com sinal recente; parado depois de 5 min sem sinal (computador hibernado)', () => {
    gravarEstado(db, CHAVES_ESTADO.vigiaVistoEm, 'x', antes(2));
    expect(montarStatus(db, ENV_COM_EMAIL, AGORA).vigia.estado).toBe('ligado');
    gravarEstado(db, CHAVES_ESTADO.vigiaVistoEm, 'x', antes(6 * 60));
    const s = montarStatus(db, ENV_COM_EMAIL, AGORA);
    expect(s.vigia).toEqual({ estado: 'parado', vistoEm: antes(6 * 60).toISOString() });
  });

  it('o limite acompanha o tique configurado', () => {
    expect(limiteVigiaParadoMs({})).toBe(5 * 60_000);
    expect(limiteVigiaParadoMs({ FRANK_TIQUE_MS: '600000' })).toBe(30 * 60_000);
    expect(limiteVigiaParadoMs({ FRANK_TIQUE_MS: 'lixo' })).toBe(5 * 60_000);
  });

  it('ultima checagem e a mais recente entre as vigilancias', () => {
    const a = criarVigilancia(db, (EXEMPLOS[0] as (typeof EXEMPLOS)[number]).vig).id;
    const b = criarVigilancia(db, (EXEMPLOS[1] as (typeof EXEMPLOS)[number]).vig).id;
    marcarRodada(db, a, antes(30));
    marcarRodada(db, b, antes(10));
    const s = montarStatus(db, ENV_COM_EMAIL, AGORA);
    expect(s.ultimaChecagemEm).toBe(antes(10).toISOString());
    expect(s.vigilanciasAtivas).toBe(2);
  });

  it('junta os problemas gravados pelo vigia', () => {
    const v = criarVigilancia(db, (EXEMPLOS[0] as (typeof EXEMPLOS)[number]).vig).id;
    marcarRodada(db, v, antes(5), {
      consultas: 3,
      itinerarios: 0,
      erros: 3,
      puladasPorTeto: 0,
      ultimoErro: 'tempo esgotado',
    });
    gravarEstado(db, CHAVES_ESTADO.ultimoErroCiclo, 'banco travado', antes(1));
    gravarEstado(db, CHAVES_ESTADO.teto('kiwi'), '300', antes(60));
    gravarEstado(db, CHAVES_ESTADO.teto('serpapi'), '240', antes(25 * 60)); // teto de ontem: ja passou
    gravarEstado(db, CHAVES_ESTADO.iaIndisponivel, 'sem login', antes(3));
    gravarEstado(db, CHAVES_ESTADO.erroAviso('email'), 'senha recusada', antes(4));
    gravarEstado(
      db,
      CHAVES_ESTADO.avisoDesistido,
      'email: Frank: GRU -> REC (senha recusada)',
      antes(4),
    );
    const s = montarStatus(db, ENV_COM_EMAIL, AGORA);
    expect(ids(s)).toEqual([
      'ciclo',
      `fonte:${v}`,
      'teto:kiwi',
      'ia',
      'erro_aviso:email',
      'desistido',
    ]);
    expect(s.claudeDisponivel).toBe(false);
    expect(s.problemas.find((p) => p.id === 'teto:kiwi')?.texto).toContain('Kiwi.com');
    expect(s.problemas.find((p) => p.id === 'erro_aviso:email')?.texto).toContain('e-mail');
  });

  it('aviso desistido ha mais de 3 dias some', () => {
    gravarEstado(db, CHAVES_ESTADO.avisoDesistido, 'x', antes(4 * 24 * 60));
    expect(ids(montarStatus(db, ENV_COM_EMAIL, AGORA))).toEqual([]);
  });

  it('sem nenhum canal completo, avisa; nunca expoe os valores', () => {
    const s = montarStatus(
      db,
      { SMTP_HOST: 'smtp.exemplo.com', TELEGRAM_BOT_TOKEN: 'segredo' },
      AGORA,
    );
    expect(s.canais).toEqual({ email: false, telegram: false });
    expect(ids(s)).toEqual(['sem-canal']);
    expect(JSON.stringify(s)).not.toContain('segredo');
  });
});
