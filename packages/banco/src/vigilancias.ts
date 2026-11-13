import { randomUUID } from 'node:crypto';
import {
  falhouInteira,
  type Estadia,
  estadiaSchema,
  type Filtros,
  filtrosSchema,
  type NovaVigilancia,
  novaVigilanciaSchema,
  type ResultadoRodadaVigilancia,
  temFiltros,
  type Vigilancia,
} from '@frank/contratos';
import { type Banco, emTransacao } from './abrir.js';

interface LinhaVigilancia {
  id: string;
  descricao: string;
  origens: string;
  destinos: string;
  ida_de: string;
  ida_ate: string;
  volta_de: string | null;
  volta_ate: string | null;
  adultos: number;
  malas_despachadas: number;
  max_escalas: number | null;
  companhias: string;
  aceitar_passagens_separadas: number;
  preco_alvo_centavos: number | null;
  moeda: string;
  intervalo_minutos: number;
  ativa: number;
  criada_em: string;
  atualizada_em: string;
  historico_desde: string;
  ultima_rodada_em: string | null;
  ultima_rodada_resultado: string | null;
  filtros: string | null;
  estadia: string | null;
}

function lerResultado(json: string | null): ResultadoRodadaVigilancia | null {
  if (!json) return null;
  try {
    const r = JSON.parse(json) as Partial<ResultadoRodadaVigilancia>;
    if (typeof r.consultas !== 'number' || typeof r.erros !== 'number') return null;
    return {
      consultas: r.consultas,
      itinerarios: r.itinerarios ?? 0,
      erros: r.erros,
      puladasPorTeto: r.puladasPorTeto ?? 0,
      ultimoErro: r.ultimoErro ?? null,
      ...(r.repeticao ? { repeticao: true } : {}),
    };
  } catch {
    return null;
  }
}

/** Leitura tolerante: JSON fora do formato vira "sem filtros", nunca derruba a tela. */
function lerFiltros(json: string | null): Filtros | null {
  if (!json) return null;
  try {
    const r = filtrosSchema.safeParse(JSON.parse(json));
    return r.success && temFiltros(r.data) ? r.data : null;
  } catch {
    return null;
  }
}

function lerEstadia(json: string | null): Estadia | null {
  if (!json) return null;
  try {
    const r = estadiaSchema.safeParse(JSON.parse(json));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

function paraVigilancia(l: LinhaVigilancia): Vigilancia {
  const filtros = lerFiltros(l.filtros);
  const estadia = l.volta_de ? lerEstadia(l.estadia) : null;
  return {
    id: l.id,
    descricao: l.descricao,
    origens: JSON.parse(l.origens) as string[],
    destinos: JSON.parse(l.destinos) as string[],
    idaDe: l.ida_de,
    idaAte: l.ida_ate,
    voltaDe: l.volta_de,
    voltaAte: l.volta_ate,
    adultos: l.adultos,
    malasDespachadas: l.malas_despachadas,
    maxEscalas: l.max_escalas,
    companhias: JSON.parse(l.companhias) as string[],
    aceitarPassagensSeparadas: l.aceitar_passagens_separadas === 1,
    precoAlvoCentavos: l.preco_alvo_centavos,
    moeda: l.moeda,
    intervaloMinutos: l.intervalo_minutos,
    ativa: l.ativa === 1,
    criadaEm: l.criada_em,
    atualizadaEm: l.atualizada_em,
    historicoDesde: l.historico_desde,
    ultimaRodadaEm: l.ultima_rodada_em,
    ultimaRodadaResultado: lerResultado(l.ultima_rodada_resultado),
    ...(filtros ? { filtros } : {}),
    ...(estadia ? { estadia } : {}),
  };
}

function parametros(v: NovaVigilancia): (string | number | null)[] {
  return [
    v.descricao,
    JSON.stringify(v.origens),
    JSON.stringify(v.destinos),
    v.idaDe,
    v.idaAte,
    v.voltaDe,
    v.voltaAte,
    v.adultos,
    v.malasDespachadas,
    v.maxEscalas,
    JSON.stringify(v.companhias),
    v.aceitarPassagensSeparadas ? 1 : 0,
    v.precoAlvoCentavos,
    v.moeda,
    v.intervaloMinutos,
    temFiltros(v.filtros) ? JSON.stringify(v.filtros) : null,
    v.estadia ? JSON.stringify(v.estadia) : null,
  ];
}

/**
 * Campos que mudam a viagem (e portanto o preco esperado). Mudar descricao, preco-alvo ou
 * intervalo nao muda a viagem e mantem o historico.
 */
function mudouAViagem(antes: NovaVigilancia, depois: NovaVigilancia): boolean {
  const viagem = (v: NovaVigilancia) =>
    JSON.stringify([
      v.origens,
      v.destinos,
      v.idaDe,
      v.idaAte,
      v.voltaDe,
      v.voltaAte,
      v.adultos,
      v.malasDespachadas,
      v.maxEscalas,
      v.companhias,
      v.aceitarPassagensSeparadas,
      v.moeda,
      v.estadia ?? null,
    ]);
  return viagem(antes) !== viagem(depois);
}

/** Valida pelo schema antes de gravar: nada fora do formato entra no banco. */
export function criarVigilancia(
  db: Banco,
  nova: NovaVigilancia,
  agora: Date = new Date(),
): Vigilancia {
  const valida = novaVigilanciaSchema.parse(nova);
  const id = randomUUID();
  const instante = agora.toISOString();
  db.prepare(
    `INSERT INTO vigilancias (descricao, origens, destinos, ida_de, ida_ate, volta_de, volta_ate,
       adultos, malas_despachadas, max_escalas, companhias, aceitar_passagens_separadas,
       preco_alvo_centavos, moeda, intervalo_minutos, filtros, estadia, id, ativa, criada_em,
       atualizada_em, historico_desde)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  ).run(...parametros(valida), id, instante, instante, instante);
  // Le de volta: o que volta e exatamente o que fica gravado (ex.: filtros todos null somem).
  return obterVigilancia(db, id) as Vigilancia;
}

export function obterVigilancia(db: Banco, id: string): Vigilancia | null {
  const linha = db.prepare('SELECT * FROM vigilancias WHERE id = ?').get(id) as
    LinhaVigilancia | undefined;
  return linha ? paraVigilancia(linha) : null;
}

export function listarVigilancias(db: Banco, filtro: { soAtivas?: boolean } = {}): Vigilancia[] {
  const sql = filtro.soAtivas
    ? 'SELECT * FROM vigilancias WHERE ativa = 1 ORDER BY criada_em'
    : 'SELECT * FROM vigilancias ORDER BY criada_em';
  return (db.prepare(sql).all() as unknown as LinhaVigilancia[]).map(paraVigilancia);
}

/**
 * Troca todos os campos editaveis (o painel manda a vigilancia inteira, ja confirmada). Se a
 * viagem mudou, o historico de preco recomeca a contar a partir de agora.
 */
export function atualizarVigilancia(
  db: Banco,
  id: string,
  dados: NovaVigilancia,
  agora: Date = new Date(),
): Vigilancia | null {
  const valida = novaVigilanciaSchema.parse(dados);
  const instante = agora.toISOString();
  return emTransacao(db, () => {
    const antes = obterVigilancia(db, id);
    if (!antes) return null;
    const mudou = mudouAViagem(antes, valida);
    const historicoDesde = mudou ? instante : antes.historicoDesde;
    // Viagem nova (outros pares): o rodizio recomeca do primeiro par, num ciclo novo.
    if (mudou) gravarRodizio(db, id, null);
    db.prepare(
      `UPDATE vigilancias SET descricao = ?, origens = ?, destinos = ?, ida_de = ?, ida_ate = ?,
         volta_de = ?, volta_ate = ?, adultos = ?, malas_despachadas = ?, max_escalas = ?,
         companhias = ?, aceitar_passagens_separadas = ?, preco_alvo_centavos = ?, moeda = ?,
         intervalo_minutos = ?, filtros = ?, estadia = ?, atualizada_em = ?, historico_desde = ?
       WHERE id = ?`,
    ).run(...parametros(valida), instante, historicoDesde, id);
    return obterVigilancia(db, id);
  });
}

/** Pausar (false) ou retomar (true). Devolve false se a vigilancia nao existe. */
export function definirAtiva(
  db: Banco,
  id: string,
  ativa: boolean,
  agora: Date = new Date(),
): boolean {
  const r = db
    .prepare('UPDATE vigilancias SET ativa = ?, atualizada_em = ? WHERE id = ?')
    .run(ativa ? 1 : 0, agora.toISOString(), id);
  return r.changes > 0;
}

/**
 * Onde o rodizio de pares parou (issue #19): o id de rodada do ciclo em andamento e o indice do
 * proximo par. Null = sem ciclo em andamento (a proxima rodada comeca do primeiro par).
 */
export interface Rodizio {
  ciclo: string;
  proximoPar: number;
}

export function obterRodizio(db: Banco, id: string): Rodizio | null {
  const l = db.prepare('SELECT ciclo, proximo_par FROM vigilancias WHERE id = ?').get(id) as
    { ciclo: string | null; proximo_par: number } | undefined;
  if (!l?.ciclo || l.proximo_par < 1) return null;
  return { ciclo: l.ciclo, proximoPar: l.proximo_par };
}

/** Grava onde o rodizio parou; null fecha o ciclo (todos os pares cobertos). */
export function gravarRodizio(db: Banco, id: string, r: Rodizio | null): void {
  db.prepare('UPDATE vigilancias SET ciclo = ?, proximo_par = ? WHERE id = ?').run(
    r?.ciclo ?? null,
    r?.proximoPar ?? 0,
    id,
  );
}

/** O vigia terminou uma rodada desta vigilancia (com sucesso ou nao) e como foi. */
export function marcarRodada(
  db: Banco,
  id: string,
  agora: Date = new Date(),
  resultado: ResultadoRodadaVigilancia | null = null,
): void {
  db.prepare(
    'UPDATE vigilancias SET ultima_rodada_em = ?, ultima_rodada_resultado = ? WHERE id = ?',
  ).run(agora.toISOString(), resultado ? JSON.stringify(resultado) : null, id);
}

/** Depois de uma rodada que falhou inteira, a tentativa extra vem neste prazo (issue #23). */
export const REPETIR_FALHA_MINUTOS = 10;

/**
 * Minutos entre a ultima rodada e a proxima: o intervalo (o da vigilancia ou o do plano de
 * consultas), ou REPETIR_FALHA_MINUTOS se a ultima falhou inteira e ainda nao era a repeticao.
 */
export function minutosAteAProxima(v: Vigilancia, intervaloMinutos = v.intervaloMinutos): number {
  const r = v.ultimaRodadaResultado;
  return falhouInteira(r) && !r?.repeticao
    ? Math.min(REPETIR_FALHA_MINUTOS, intervaloMinutos)
    : intervaloMinutos;
}

/** A proxima rodada da vigilancia ja venceu? Nunca rodou ou data ilegivel: sim. */
export function rodadaVencida(
  v: Vigilancia,
  agora: Date,
  intervaloMinutos = v.intervaloMinutos,
): boolean {
  if (v.ultimaRodadaEm === null) return true;
  const ultima = Date.parse(v.ultimaRodadaEm);
  // Data ilegivel conta como vencida: a vigilancia nunca pode ficar parada para sempre.
  return (
    Number.isNaN(ultima) ||
    ultima + minutosAteAProxima(v, intervaloMinutos) * 60_000 <= agora.getTime()
  );
}

/**
 * Vigilancias ativas cuja proxima rodada ja venceu: nunca rodaram, ou a ultima rodada foi ha
 * pelo menos `intervaloMinutos` (10 min, se ela falhou inteira). As que esperam ha mais tempo
 * vem primeiro.
 */
export function vigilanciasDevidas(db: Banco, agora: Date = new Date()): Vigilancia[] {
  return listarVigilancias(db, { soAtivas: true })
    .filter((v) => rodadaVencida(v, agora))
    .sort((a, b) => (a.ultimaRodadaEm ?? '').localeCompare(b.ultimaRodadaEm ?? ''));
}

/** Apaga a vigilancia e tudo dela (precos, ofertas, alertas, placar). E pedido da pessoa. */
export function apagarVigilancia(db: Banco, id: string): boolean {
  return db.prepare('DELETE FROM vigilancias WHERE id = ?').run(id).changes > 0;
}
