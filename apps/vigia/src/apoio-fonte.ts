import { apagarEstado, type Banco, CHAVES_ESTADO, contarConsultas, gravarEstado, registrarConsulta } from '@frank/banco';
import type { Itinerario, ResultadoRodadaVigilancia } from '@frank/contratos';
import type { Logger } from './log.js';

/** O que as partes do vigia que consultam fontes precisam. */
export interface ContextoFonte {
  db: Banco;
  /** Maximo de consultas por fonte nas ultimas 24 h (SPEC-01 RF-04). */
  tetoDiarioPorFonte: number;
  log: Logger;
}

const UM_DIA_MS = 86_400_000;

/** Mensagem curta de erro para o banco e o log: sem pilha, sem token. */
export function resumirErro(erro: unknown): string {
  const texto = erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro);
  return texto.slice(0, 200);
}

/** Confere o teto de 24 h da fonte. Atingido: fica gravado para o painel e na rodada. */
export function podeConsultar(
  ctx: ContextoFonte,
  fonte: string,
  agora: Date,
  resultado: ResultadoRodadaVigilancia,
): boolean {
  const desde24h = new Date(agora.getTime() - UM_DIA_MS);
  if (contarConsultas(ctx.db, fonte, desde24h) >= ctx.tetoDiarioPorFonte) {
    resultado.puladasPorTeto++;
    resultado.ultimoErro = `${fonte}: teto de ${ctx.tetoDiarioPorFonte} consultas em 24 h atingido`;
    gravarEstado(ctx.db, CHAVES_ESTADO.teto(fonte), String(ctx.tetoDiarioPorFonte), agora);
    ctx.log.aviso(resultado.ultimoErro);
    return false;
  }
  apagarEstado(ctx.db, CHAVES_ESTADO.teto(fonte));
  return true;
}

export function registrarConsultaSemLancar(
  ctx: ContextoFonte,
  fonte: string,
  r: { sucesso: boolean; erro?: string },
  agora: Date,
): void {
  try {
    registrarConsulta(ctx.db, fonte, r, agora);
  } catch (erro) {
    ctx.log.erro(`não consegui registrar a consulta à ${fonte}: ${resumirErro(erro)}`);
  }
}

/** Moeda diferente da pedida nunca entra no historico calada: viraria preco sem mediana. */
export function conferirMoeda(itinerarios: readonly Itinerario[], moeda: string): string | null {
  const outra = itinerarios.find((it) => it.moeda !== moeda);
  return outra ? `respondeu em ${outra.moeda}, pedido em ${moeda}` : null;
}
