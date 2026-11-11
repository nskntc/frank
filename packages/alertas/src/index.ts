export { canaisDoAmbiente } from './canais.js';
export { type CanalAlerta, CanalFalhouError, type Logger, type MensagemAlerta } from './canal.js';
export { type ConfigEmail, EmailSmtp, type TransporteEmail } from './email.js';
export { type ContextoAlertas, enviarAlertasPendentes, type ResumoAlertas } from './enviar.js';
export { type DadosAlerta, montarMensagem } from './mensagem.js';
export { type ConfigTelegram, TelegramBot } from './telegram.js';
