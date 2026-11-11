import { type CanalAlerta, CanalFalhouError, type MensagemAlerta } from './canal.js';

export interface ConfigTelegram {
  /** Token do bot (BotFather). Vai na URL da API: nunca em log nem mensagem de erro. */
  token: string;
  chatId: string;
  fetch?: typeof fetch;
}

const NOME = 'telegram';
/** Limite do Telegram por mensagem. */
const TAMANHO_MAXIMO = 4096;

/**
 * Aviso pelo Telegram (opcional; gratis). Sem parse_mode: o texto e puro, nada vira negrito nem
 * link formatado. Sem previa de link: so o link de compra aparece, como texto.
 */
export class TelegramBot implements CanalAlerta {
  readonly nome = NOME;

  constructor(private readonly config: ConfigTelegram) {
    if (!config.token || !config.chatId) throw new Error('Telegram sem TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID.');
  }

  async enviar(mensagem: MensagemAlerta): Promise<void> {
    const texto = `${mensagem.assunto}\n\n${mensagem.texto}`.slice(0, TAMANHO_MAXIMO);
    let resposta: Response;
    try {
      resposta = await (this.config.fetch ?? fetch)(`https://api.telegram.org/bot${this.config.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: this.config.chatId, text: texto, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (erro) {
      // Mensagem sem a URL: ela carrega o token.
      throw new CanalFalhouError(NOME, 'sem resposta (rede ou tempo limite)', { cause: erro });
    }
    if (resposta.status === 401 || resposta.status === 404) {
      throw new CanalFalhouError(NOME, 'token recusado (confira TELEGRAM_BOT_TOKEN)');
    }
    if (resposta.status === 400 || resposta.status === 403) {
      throw new CanalFalhouError(NOME, 'chat recusado (confira TELEGRAM_CHAT_ID e se você mandou uma mensagem ao bot)');
    }
    if (!resposta.ok) throw new CanalFalhouError(NOME, `HTTP ${resposta.status}`);
  }
}
