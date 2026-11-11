import nodemailer from 'nodemailer';
import { type CanalAlerta, CanalFalhouError, type MensagemAlerta } from './canal.js';

export interface ConfigEmail {
  host: string;
  porta: number;
  usuario: string;
  /** Senha de app (Gmail) ou do SMTP. Nunca vai para log nem mensagem de erro. */
  senha: string;
  /** Para quem vai o aviso (normalmente a propria pessoa). */
  para: string;
}

/** O que o canal usa do nodemailer (permite um transporte falso nos testes). */
export interface TransporteEmail {
  sendMail(opcoes: { from: string; to: string; subject: string; text: string }): Promise<unknown>;
}

const NOME = 'email';

/** Le so codigos do erro do SMTP: a mensagem pode ecoar dados da conexao. */
function motivo(erro: unknown): string {
  const e = erro as { code?: unknown; responseCode?: unknown };
  if (e.responseCode === 535 || e.code === 'EAUTH') {
    return 'usuário ou senha recusados (confira SMTP_USUARIO e a senha de app em SMTP_SENHA)';
  }
  if (e.code === 'ECONNECTION' || e.code === 'ETIMEDOUT' || e.code === 'ESOCKET' || e.code === 'EDNS') {
    return 'não consegui conectar ao servidor (confira SMTP_HOST, SMTP_PORTA e a internet)';
  }
  const codigo = typeof e.responseCode === 'number' ? ` (SMTP ${e.responseCode})` : typeof e.code === 'string' ? ` (${e.code})` : '';
  return `envio recusado${codigo}`;
}

/**
 * Aviso por e-mail pelo SMTP da propria pessoa, para ela mesma. Gmail: smtp.gmail.com, porta
 * 465, senha de app. Texto puro: o resumo vem do Claude e nunca vira HTML.
 */
export class EmailSmtp implements CanalAlerta {
  readonly nome = NOME;
  private readonly transporte: TransporteEmail;

  constructor(
    private readonly config: ConfigEmail,
    transporte?: TransporteEmail,
  ) {
    for (const campo of ['host', 'usuario', 'senha', 'para'] as const) {
      if (!config[campo]) throw new Error(`E-mail sem ${campo}: confira as variáveis SMTP_* e ALERTA_EMAIL_PARA no .env.`);
    }
    this.transporte =
      transporte ??
      nodemailer.createTransport({
        host: config.host,
        port: config.porta,
        secure: config.porta === 465,
        requireTLS: config.porta !== 465,
        auth: { user: config.usuario, pass: config.senha },
        connectionTimeout: 20_000,
        socketTimeout: 30_000,
      });
  }

  async enviar(mensagem: MensagemAlerta): Promise<void> {
    try {
      await this.transporte.sendMail({
        from: `Frank <${this.config.usuario}>`,
        to: this.config.para,
        subject: mensagem.assunto,
        text: mensagem.texto,
      });
    } catch (erro) {
      throw new CanalFalhouError(NOME, motivo(erro), { cause: erro });
    }
  }
}
