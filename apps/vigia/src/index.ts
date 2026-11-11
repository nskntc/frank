import { join } from 'node:path';
import { abrirBanco, caminhoDoBanco, raizDoRepositorio } from '@frank/banco';
import { KiwiMcp, SerpApiGoogleFlights } from '@frank/fontes';
import { ClaudeCli, ComOrcamento } from '@frank/ia';
import { lerConfig } from './config.js';
import { log } from './log.js';
import { resumirErro } from './rodada.js';
import { Vigia } from './vigia.js';

/** Quanto o desligamento espera a rodada em andamento antes de sair mesmo assim. */
const PRAZO_PARA_PARAR_MS = 15_000;

// O .env fica na raiz do repositorio; o vigia roda em apps/vigia.
try {
  process.loadEnvFile(join(raizDoRepositorio(), '.env'));
} catch {
  // sem .env: valem as variaveis do ambiente
}

/** Liga o vigia: abre o banco da raiz do repo, consulta a Kiwi e roda ate receber Ctrl+C. */
const config = lerConfig();
const caminho = caminhoDoBanco();
const db = abrirBanco(caminho);
const vigia = new Vigia(
  {
    db,
    fontes: [new KiwiMcp()],
    tetoDiarioPorFonte: config.tetoDiarioPorFonte,
    maxBuscasPorPar: config.maxBuscasPorPar,
    ia: new ComOrcamento(new ClaudeCli(config.modeloIa ? { modelo: config.modeloIa } : {}), db, {
      limiteDiario: config.limiteDiarioIa,
    }),
    ...(config.chaveSerpApi
      ? { serpapi: new SerpApiGoogleFlights({ chave: config.chaveSerpApi }), tetoMensalSerpApi: config.tetoMensalSerpApi }
      : {}),
    log,
  },
  config.tiqueMs,
);

log.info(
  `Frank: vigia ligado (banco em ${caminho}; Google Flights ${config.chaveSerpApi ? 'ligado' : 'desligado, sem SERPAPI_API_KEY'}). Ctrl+C para parar.`,
);
vigia.iniciar();

let parando = false;
async function desligar(): Promise<void> {
  if (parando) {
    // Segundo Ctrl+C: sai na hora. O que ja foi gravado esta salvo (escritas sincronas, WAL).
    log.aviso('Frank: saindo sem esperar a rodada em andamento.');
    process.exit(1);
  }
  parando = true;
  log.info('Frank: desligando o vigia (Ctrl+C de novo para sair na hora)...');
  try {
    const prazo = new Promise<'prazo'>((ok) => setTimeout(() => ok('prazo'), PRAZO_PARA_PARAR_MS).unref());
    if ((await Promise.race([vigia.parar(), prazo])) === 'prazo') {
      log.aviso('Frank: a rodada em andamento demorou demais; saindo assim mesmo.');
    }
    db.close();
    process.exit(0);
  } catch (erro) {
    log.erro(`Frank: erro ao desligar: ${resumirErro(erro)}`);
    process.exit(1);
  }
}

process.on('SIGINT', () => void desligar());
process.on('SIGTERM', () => void desligar());
