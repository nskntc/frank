import {
  type Banco,
  CHAVES_ESTADO,
  lerEstado,
  listarEstado,
  listarVigilancias,
} from '@frank/banco';

/** Variaveis de ambiente (process.env ou um objeto simples nos testes). */
type Ambiente = Readonly<Record<string, string | undefined>>;

const MIN_MS = 60_000;
const HORA_MS = 60 * MIN_MS;

/** Nome das fontes e canais para a tela. Nome desconhecido aparece como veio. */
const NOMES: Record<string, string> = {
  kiwi: 'Kiwi.com',
  serpapi: 'Google Flights (SerpApi)',
  email: 'e-mail',
  telegram: 'Telegram',
};
const nome = (chave: string) => NOMES[chave] ?? chave;

export interface Problema {
  /** Chave estavel para a lista (React) e para os testes. */
  id: string;
  texto: string;
  desde: string;
}

export interface StatusFrank {
  vigia: { estado: 'ligado' | 'parado' | 'nunca'; vistoEm: string | null };
  /** A checagem mais recente entre as vigilancias (instante ISO). */
  ultimaChecagemEm: string | null;
  vigilanciasAtivas: number;
  canais: { email: boolean; telegram: boolean };
  claudeDisponivel: boolean;
  problemas: Problema[];
}

/**
 * Vigia parado: sem sinal ha mais de 3 tiques (e pelo menos 5 min). Cobre computador hibernado
 * (RNF-08): o vigia nao grava nada enquanto o computador dorme.
 */
export function limiteVigiaParadoMs(env: Ambiente): number {
  const tique = Number(env.FRANK_TIQUE_MS || '60000');
  return Math.max(5 * MIN_MS, 3 * (Number.isFinite(tique) && tique > 0 ? tique : 60_000));
}

/** So diz se o canal esta preenchido no .env; nunca le nem devolve o valor. */
function canaisConfigurados(env: Ambiente): StatusFrank['canais'] {
  const cheio = (k: string) => Boolean(env[k]?.trim());
  return {
    email: ['SMTP_HOST', 'SMTP_USUARIO', 'SMTP_SENHA', 'ALERTA_EMAIL_PARA'].every(cheio),
    telegram: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'].every(cheio),
  };
}

/** Barra de status e tela de Configuracoes (RF-19): tudo que o vigia deixou em estado_vigia. */
export function montarStatus(
  db: Banco,
  env: Ambiente = process.env,
  agora: Date = new Date(),
): StatusFrank {
  const visto = lerEstado(db, CHAVES_ESTADO.vigiaVistoEm);
  const parado =
    visto && agora.getTime() - Date.parse(visto.atualizadoEm) > limiteVigiaParadoMs(env);
  const ativas = listarVigilancias(db, { soAtivas: true });
  const ultimaChecagemEm =
    listarVigilancias(db)
      .map((v) => v.ultimaRodadaEm)
      .filter((t): t is string => Boolean(t))
      .sort()
      .at(-1) ?? null;

  const problemas: Problema[] = [];
  const erroCiclo = lerEstado(db, CHAVES_ESTADO.ultimoErroCiclo);
  if (erroCiclo) {
    problemas.push({
      id: 'ciclo',
      texto: `O vigia não conseguiu completar o ciclo: ${erroCiclo.valor}`,
      desde: erroCiclo.atualizadoEm,
    });
  }

  for (const v of ativas) {
    const r = v.ultimaRodadaResultado;
    if (r && r.erros > 0 && v.ultimaRodadaEm) {
      problemas.push({
        id: `fonte:${v.id}`,
        texto: `Erro na busca de "${v.descricao}": ${r.ultimoErro ?? 'a fonte não respondeu'}`,
        desde: v.ultimaRodadaEm,
      });
    }
  }

  for (const t of listarEstado(db, 'teto:')) {
    // O teto e de 24 h: passado esse tempo, a fonte volta sozinha.
    if (agora.getTime() - Date.parse(t.atualizadoEm) > 24 * HORA_MS) continue;
    const fonte = nome(t.chave.slice('teto:'.length));
    problemas.push({
      id: t.chave,
      texto: `${fonte} chegou ao limite de ${t.valor} consultas em 24 h: algumas checagens ficam para depois.`,
      desde: t.atualizadoEm,
    });
  }

  const ia = lerEstado(db, CHAVES_ESTADO.iaIndisponivel);
  if (ia)
    problemas.push({ id: 'ia', texto: `Claude indisponível: ${ia.valor}`, desde: ia.atualizadoEm });

  for (const e of listarEstado(db, 'erro_aviso:')) {
    const canal = nome(e.chave.slice('erro_aviso:'.length));
    problemas.push({
      id: e.chave,
      texto: `O aviso por ${canal} falhou: ${e.valor}`,
      desde: e.atualizadoEm,
    });
  }

  const desistido = lerEstado(db, CHAVES_ESTADO.avisoDesistido);
  if (desistido && agora.getTime() - Date.parse(desistido.atualizadoEm) <= 3 * 24 * HORA_MS) {
    problemas.push({
      id: 'desistido',
      texto: `Um aviso não foi entregue depois de 3 tentativas: ${desistido.valor}`,
      desde: desistido.atualizadoEm,
    });
  }

  const canais = canaisConfigurados(env);
  if (!canais.email && !canais.telegram) {
    problemas.push({
      id: 'sem-canal',
      texto:
        'Nenhum aviso configurado: as ofertas só aparecem no painel. Veja "Avisos" em Configurações.',
      desde: agora.toISOString(),
    });
  }

  return {
    vigia: {
      estado: !visto ? 'nunca' : parado ? 'parado' : 'ligado',
      vistoEm: visto?.atualizadoEm ?? null,
    },
    ultimaChecagemEm,
    vigilanciasAtivas: ativas.length,
    canais,
    claudeDisponivel: !ia,
    problemas,
  };
}
