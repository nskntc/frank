import {
  abrirBanco,
  type Banco,
  CHAVES_ESTADO,
  CONFIGURACOES,
  criarVigilancia,
  definirAtiva,
  gravarConfiguracaoNumero,
  lerEstado,
  registrarOferta,
  registrarPrecosVistos,
  salvarAvaliacao,
  salvarOpcoesCompra,
} from '@frank/banco';
import type { Itinerario, NovaVigilancia } from '@frank/contratos';
import { beforeEach, describe, expect, it } from 'vitest';
import { canaisDoAmbiente } from './canais.js';
import { type CanalAlerta, CanalFalhouError, type Logger, type MensagemAlerta } from './canal.js';
import { EmailSmtp } from './email.js';
import { enviarAlertasPendentes } from './enviar.js';
import { montarMensagem, quando } from './mensagem.js';
import { TelegramBot } from './telegram.js';

// Dados ficticios (repo publico).
const vigilanciaExemplo: NovaVigilancia = {
  descricao: 'São Paulo → Recife, março',
  origens: ['CGH'],
  destinos: ['REC'],
  idaDe: '2027-03-12',
  idaAte: '2027-03-12',
  voltaDe: '2027-03-19',
  voltaAte: '2027-03-19',
  adultos: 1,
  malasDespachadas: 0,
  maxEscalas: null,
  companhias: [],
  aceitarPassagensSeparadas: false,
  precoAlvoCentavos: 120_000,
  moeda: 'BRL',
  intervaloMinutos: 60,
};

function trecho(de: string, para: string, partida: string, chegada: string) {
  return { de, para, partida, chegada, companhia: 'Azul', codigoCompanhia: 'AD', numeroVoo: 'AD0000' };
}

const itinerario: Itinerario = {
  fonte: 'kiwi',
  idNaFonte: 'voo-1',
  precoCentavos: 108_300,
  moeda: 'BRL',
  linkCompra: 'https://www.kiwi.com/u/exemplo',
  malas: { item: 1, mao: 1, despachada: 0 },
  ida: { de: 'CGH', para: 'REC', partida: '2027-03-12T10:45:00', chegada: '2027-03-12T13:55:00', duracaoSegundos: 11_400, escalas: 0, trechos: [trecho('CGH', 'REC', '2027-03-12T10:45:00', '2027-03-12T13:55:00')] },
  volta: { de: 'REC', para: 'CGH', partida: '2027-03-19T17:20:00', chegada: '2027-03-19T20:35:00', duracaoSegundos: 11_700, escalas: 0, trechos: [trecho('REC', 'CGH', '2027-03-19T17:20:00', '2027-03-19T20:35:00')] },
};

const agora = new Date('2026-11-11T15:00:00.000Z'); // 12h em Brasilia
const semLog: Logger = { info() {}, aviso() {}, erro() {} };

class CanalFalso implements CanalAlerta {
  enviadas: MensagemAlerta[] = [];
  falhar = false;
  constructor(readonly nome: string) {}
  async enviar(m: MensagemAlerta): Promise<void> {
    if (this.falhar) throw new CanalFalhouError(this.nome, 'fora do ar');
    this.enviadas.push(m);
  }
}

let db: Banco;
let vigilanciaId: string;
beforeEach(() => {
  db = abrirBanco(':memory:');
  vigilanciaId = criarVigilancia(db, vigilanciaExemplo).id;
});

function novaOferta(preco = 112_091, idNaFonte = 'voo-1') {
  const v = { id: vigilanciaId };
  const precoVistoId = registrarPrecosVistos(db, v.id, 'r1', [{ ...itinerario, idNaFonte }], agora)[0] as number;
  const oferta = registrarOferta(
    db,
    { vigilanciaId: v.id, precoVistoId, precoFinalCentavos: preco, moeda: 'BRL', precoNormalCentavos: 150_000, percentualAbaixo: 28, motivos: ['abaixo_do_normal'] },
    agora,
  );
  salvarOpcoesCompra(db, oferta.id, [
    { vendedor: 'Kiwi.com', precoCentavos: 108_300, moeda: 'BRL', estrangeiro: true, link: 'https://www.kiwi.com/u/exemplo' },
    { vendedor: 'Azul', precoCentavos: 108_300, moeda: 'BRL', estrangeiro: false, ehCompanhia: true, link: null },
  ]);
  return oferta;
}

describe('montarMensagem', () => {
  it('traz rota, preco, voos, onde comprar com links e os lembretes', () => {
    const m = montarMensagem({
      vigilancia: { descricao: 'São Paulo → Recife, março', adultos: 1 },
      itinerario,
      precoFinalCentavos: 112_091,
      percentualAbaixo: 28,
      avaliacao: { valeAPena: true, pegadinhas: [{ tipo: 'sem_mala_despachada', descricao: 'Tarifa só com bagagem de mão.' }], resumo: 'Direto e bem abaixo do normal.' },
      ondeComprar: {
        itens: [
          { vendedor: 'Azul', precoCentavos: 108_300, precoFinalCentavos: 108_300, estrangeiro: false, ehCompanhia: true, link: 'https://www.voeazul.com.br/x', etiquetas: ['24h_para_desistir'] },
          { vendedor: 'Kiwi.com', precoCentavos: 108_300, precoFinalCentavos: 112_091, estrangeiro: true, ehCompanhia: false, link: 'https://www.kiwi.com/u/exemplo', etiquetas: ['empresa_estrangeira'] },
        ],
        destacado: 0,
        motivo: 'mais_barato',
      },
      vistoEm: '2026-11-12T02:05:00.000Z',
    });
    expect(m.assunto).toBe('Frank: CGH -> REC por R$ 1.083,00');
    expect(m.texto).toContain('Preço conferido na fonte em 11/11 às 23:05 (horário de Brasília).');
    expect(m.texto).toContain('(28% abaixo do normal)');
    expect(m.texto).toContain('Ida: CGH sex 12/03 10:45 -> REC sex 12/03 13:55, Azul, direto');
    expect(m.texto).toContain('Volta: REC sex 19/03 17:20 -> CGH sex 19/03 20:35');
    expect(m.texto).toContain('Vale a pena: Direto e bem abaixo do normal.');
    expect(m.texto).toContain('- Tarifa só com bagagem de mão.');
    expect(m.texto).toContain('* Azul: R$ 1.083,00 [24 h para desistir]');
    expect(m.texto).toContain('  https://www.voeazul.com.br/x');
    expect(m.texto).toContain('nome exatamente como no documento');
  });
});

describe('quando', () => {
  it.each([
    ['2027-03-14T08:00:00', 'dom 14/03 08:00'],
    ['2027-03-15T23:59:00', 'seg 15/03 23:59'],
    ['2028-02-29T06:10:00', 'ter 29/02 06:10'],
  ])('%s -> %s', (horario, esperado) => {
    expect(quando(horario)).toBe(esperado);
  });
});

describe('EmailSmtp', () => {
  it('manda texto puro, do proprio usuario para o destinatario', async () => {
    const enviados: unknown[] = [];
    const email = new EmailSmtp(
      { host: 'smtp.exemplo', porta: 465, usuario: 'eu@exemplo.com', senha: 'senha-de-app', para: 'eu@exemplo.com' },
      { sendMail: async (o) => void enviados.push(o) },
    );
    await email.enviar({ assunto: 'A', texto: 'B' });
    expect(enviados).toEqual([{ from: 'Frank <eu@exemplo.com>', to: 'eu@exemplo.com', subject: 'A', text: 'B' }]);
  });

  it('senha recusada vira mensagem clara, sem a senha', async () => {
    const email = new EmailSmtp(
      { host: 'smtp.exemplo', porta: 465, usuario: 'eu@exemplo.com', senha: 'senha-secreta', para: 'eu@exemplo.com' },
      {
        sendMail: async () => {
          throw Object.assign(new Error('Invalid login: senha-secreta'), { code: 'EAUTH', responseCode: 535 });
        },
      },
    );
    const erro = (await email.enviar({ assunto: 'A', texto: 'B' }).catch((e: unknown) => e)) as Error;
    expect(erro.message).toContain('senha recusados');
    expect(erro.message).not.toContain('senha-secreta');
  });
});

describe('TelegramBot', () => {
  it('manda sem parse_mode e sem previa de link; erro sem o token', async () => {
    const corpos: unknown[] = [];
    const bot = new TelegramBot({
      token: '123:token-secreto',
      chatId: '42',
      fetch: async (_url, init) => {
        corpos.push(JSON.parse(String(init?.body)));
        return new Response('{}', { status: 200 });
      },
    });
    await bot.enviar({ assunto: 'A', texto: 'B' });
    expect(corpos[0]).toEqual({ chat_id: '42', text: 'A\n\nB', disable_web_page_preview: true });

    const ruim = new TelegramBot({ token: '123:token-secreto', chatId: '42', fetch: async () => new Response('', { status: 401 }) });
    const erro = (await ruim.enviar({ assunto: 'A', texto: 'B' }).catch((e: unknown) => e)) as Error;
    expect(erro.message).not.toContain('token-secreto');
  });
});

describe('canaisDoAmbiente', () => {
  it('so os canais configurados; configuracao pela metade e erro', () => {
    expect(canaisDoAmbiente({})).toEqual([]);
    const email = { SMTP_HOST: 'smtp.exemplo', SMTP_USUARIO: 'eu@exemplo.com', SMTP_SENHA: 'x', ALERTA_EMAIL_PARA: 'eu@exemplo.com' };
    expect(canaisDoAmbiente(email).map((c) => c.nome)).toEqual(['email']);
    expect(() => canaisDoAmbiente({ SMTP_HOST: 'smtp.exemplo' })).toThrow(/SMTP|ALERTA/);
    expect(() => canaisDoAmbiente({ TELEGRAM_BOT_TOKEN: 'x' })).toThrow(/TELEGRAM/);
  });
});

describe('enviarAlertasPendentes', () => {
  it('manda a oferta nova por todos os canais e nao manda de novo', async () => {
    novaOferta();
    const email = new CanalFalso('email');
    const telegram = new CanalFalso('telegram');
    const ctx = { db, canais: [email, telegram], log: semLog };
    expect(await enviarAlertasPendentes(ctx, agora)).toMatchObject({ enviados: 2 });
    expect(email.enviadas[0]?.texto).toContain('* Azul');
    expect(await enviarAlertasPendentes(ctx, agora)).toMatchObject({ enviados: 0 });
  });

  it('mesmo voo por preco igual ou maior nao e avisado de novo; mais barato e', async () => {
    novaOferta(112_091);
    const email = new CanalFalso('email');
    const ctx = { db, canais: [email], log: semLog };
    await enviarAlertasPendentes(ctx, agora);
    novaOferta(112_091);
    expect(await enviarAlertasPendentes(ctx, agora)).toMatchObject({ enviados: 0, puladas: 1 });
    novaOferta(100_000);
    expect(await enviarAlertasPendentes(ctx, agora)).toMatchObject({ enviados: 1 });
  });

  it('oferta que o Claude julgou "nao vale a pena" fica so no painel', async () => {
    const oferta = novaOferta();
    salvarAvaliacao(db, oferta.id, { valeAPena: false, pegadinhas: [], resumo: 'Duas escalas longas.' });
    expect(await enviarAlertasPendentes({ db, canais: [new CanalFalso('email')], log: semLog }, agora)).toMatchObject({
      enviados: 0,
      puladas: 1,
    });
  });

  it('horario silencioso guarda o aviso e manda quando acaba', async () => {
    novaOferta();
    gravarConfiguracaoNumero(db, CONFIGURACOES.silencioInicio, 23);
    gravarConfiguracaoNumero(db, CONFIGURACOES.silencioFim, 7);
    const email = new CanalFalso('email');
    const ctx = { db, canais: [email], log: semLog };
    expect(await enviarAlertasPendentes(ctx, new Date('2026-11-12T05:00:00Z'))).toMatchObject({ adiadas: 1 }); // 2h
    expect(await enviarAlertasPendentes(ctx, new Date('2026-11-12T10:00:00Z'))).toMatchObject({ enviados: 1 }); // 7h
  });

  it('falha num canal: espera 5 e 30 min entre tentativas, desiste na 3a e grava para o painel', async () => {
    novaOferta();
    const email = new CanalFalso('email');
    email.falhar = true;
    const ctx = { db, canais: [email], log: semLog };
    const min = (m: number) => new Date(agora.getTime() + m * 60_000);

    expect(await enviarAlertasPendentes(ctx, min(0))).toMatchObject({ falhas: 1 });
    expect(await enviarAlertasPendentes(ctx, min(1))).toMatchObject({ falhas: 0 }); // ainda esperando
    expect(await enviarAlertasPendentes(ctx, min(5))).toMatchObject({ falhas: 1 });
    expect(await enviarAlertasPendentes(ctx, min(20))).toMatchObject({ falhas: 0 });
    expect(await enviarAlertasPendentes(ctx, min(35))).toMatchObject({ falhas: 1, desistidos: 1 });
    expect(await enviarAlertasPendentes(ctx, min(120))).toMatchObject({ falhas: 0, enviados: 0 });
    expect(lerEstado(db, CHAVES_ESTADO.avisoDesistido)?.valor).toContain('email: Frank: CGH -> REC');
    expect(lerEstado(db, CHAVES_ESTADO.erroAviso('email'))?.valor).toContain('fora do ar');
  });

  it('volta a funcionar antes de desistir: entrega e apaga o erro do canal', async () => {
    novaOferta();
    const email = new CanalFalso('email');
    email.falhar = true;
    const ctx = { db, canais: [email], log: semLog };
    await enviarAlertasPendentes(ctx, agora);
    email.falhar = false;
    expect(await enviarAlertasPendentes(ctx, new Date(agora.getTime() + 5 * 60_000))).toMatchObject({ enviados: 1 });
    expect(lerEstado(db, CHAVES_ESTADO.erroAviso('email'))).toBeNull();
  });

  it('um canal entrega e o outro falha: so o que falhou tenta de novo', async () => {
    novaOferta();
    const email = new CanalFalso('email');
    const telegram = new CanalFalso('telegram');
    telegram.falhar = true;
    const ctx = { db, canais: [email, telegram], log: semLog };
    expect(await enviarAlertasPendentes(ctx, agora)).toMatchObject({ enviados: 1, falhas: 1 });
    telegram.falhar = false;
    expect(await enviarAlertasPendentes(ctx, new Date(agora.getTime() + 5 * 60_000))).toMatchObject({ enviados: 1 });
    expect([email.enviadas.length, telegram.enviadas.length]).toEqual([1, 1]);
  });

  it('vigilancia pausada nao gera aviso', async () => {
    novaOferta();
    definirAtiva(db, vigilanciaId, false);
    expect(await enviarAlertasPendentes({ db, canais: [new CanalFalso('email')], log: semLog }, agora)).toMatchObject({
      enviados: 0,
      puladas: 1,
    });
  });

  it('no silencio, conta como guardada so a que ia sair', async () => {
    const naoVale = novaOferta(112_091, 'voo-2');
    salvarAvaliacao(db, naoVale.id, { valeAPena: false, pegadinhas: [], resumo: 'x' });
    novaOferta(112_091, 'voo-3');
    gravarConfiguracaoNumero(db, CONFIGURACOES.silencioInicio, 0);
    gravarConfiguracaoNumero(db, CONFIGURACOES.silencioFim, 23);
    expect(await enviarAlertasPendentes({ db, canais: [new CanalFalso('email')], log: semLog }, agora)).toMatchObject({
      adiadas: 1,
      puladas: 1,
    });
  });

  it('oferta com mais de 24 h nao e avisada', async () => {
    novaOferta();
    expect(
      await enviarAlertasPendentes({ db, canais: [new CanalFalso('email')], log: semLog }, new Date('2026-11-12T16:00:00Z')),
    ).toMatchObject({ enviados: 0 });
  });
});
