import { join } from 'node:path';
import { canaisDoAmbiente } from '@frank/alertas';
import { raizDoRepositorio } from '@frank/banco';
import { log } from './log.js';
import { resumirErro } from './rodada.js';

/**
 * Manda um aviso de teste por cada canal configurado no .env, para conferir o e-mail (ou o
 * Telegram) antes de deixar o vigia rodando:  pnpm --filter @frank/vigia testar-aviso
 */
try {
  process.loadEnvFile(join(raizDoRepositorio(), '.env'));
} catch (erro) {
  // Sem .env, valem as variaveis do ambiente; .env ilegivel e erro de verdade.
  if ((erro as { code?: string }).code !== 'ENOENT') throw erro;
}

const canais = canaisDoAmbiente();
if (!canais.length) {
  log.aviso('Nenhum canal configurado. Preencha SMTP_* e ALERTA_EMAIL_PARA (ou TELEGRAM_*) no .env.');
  process.exit(1);
}

let falhou = false;
for (const canal of canais) {
  try {
    await canal.enviar({
      assunto: 'Frank: teste de aviso',
      texto:
        'Se você recebeu esta mensagem, o Frank consegue te avisar por aqui.\n\n' +
        'Quando ele achar uma passagem muito abaixo do normal numa rota que você vigia, o aviso chega assim, ' +
        'com o preço final, onde comprar e os cuidados.',
    });
    log.info(`aviso de teste enviado por ${canal.nome}`);
  } catch (erro) {
    falhou = true;
    log.erro(`aviso de teste por ${canal.nome} falhou: ${resumirErro(erro)}`);
  }
}
process.exit(falhou ? 1 : 0);
