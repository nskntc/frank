import type { CanalAlerta } from './canal.js';
import { EmailSmtp } from './email.js';
import { TelegramBot } from './telegram.js';

/**
 * Os canais configurados no ambiente (.env). Canal sem configuracao fica de fora; configuracao
 * pela metade lanca erro na partida (melhor que descobrir na hora de avisar).
 */
export function canaisDoAmbiente(env: NodeJS.ProcessEnv = process.env): CanalAlerta[] {
  const canais: CanalAlerta[] = [];
  if (['SMTP_HOST', 'SMTP_USUARIO', 'SMTP_SENHA', 'ALERTA_EMAIL_PARA'].some((k) => env[k])) {
    const porta = Number(env.SMTP_PORTA || '465');
    if (!Number.isInteger(porta) || porta <= 0) throw new Error('SMTP_PORTA inválida no .env.');
    canais.push(
      new EmailSmtp({
        host: env.SMTP_HOST ?? '',
        porta,
        usuario: env.SMTP_USUARIO ?? '',
        senha: env.SMTP_SENHA ?? '',
        para: env.ALERTA_EMAIL_PARA ?? '',
      }),
    );
  }
  if (env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_CHAT_ID) {
    canais.push(new TelegramBot({ token: env.TELEGRAM_BOT_TOKEN ?? '', chatId: env.TELEGRAM_CHAT_ID ?? '' }));
  }
  return canais;
}
