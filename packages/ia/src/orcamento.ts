import {
  apagarEstado,
  type Banco,
  CHAVES_ESTADO,
  contarChamadasIa,
  gravarEstado,
  registrarChamadaIa,
} from '@frank/banco';
import {
  IaIndisponivelError,
  type PedidoIa,
  type ProvedorLLM,
  type RespostaIa,
  RespostaIaInvalidaError,
} from './provedor.js';

/** Chamadas ao Claude por 24 h (SPEC-01 RNF-03, calibrar). */
export const LIMITE_DIARIO_PADRAO = 30;
const UM_DIA_MS = 86_400_000;

export interface OpcoesOrcamento {
  limiteDiario?: number;
  relogio?: () => Date;
}

function resumir(erro: unknown): string {
  return (erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro)).slice(0, 200);
}

/**
 * O Claude com orcamento diario e registro de cada chamada (RNF-03, RF-11):
 * - acima do limite de 24 h, nem chama: IaIndisponivelError('orcamento');
 * - resposta fora do formato: tenta mais uma vez (se ainda couber no orcamento), depois desiste;
 * - indisponivel (sem login, limite do plano, tempo...): grava o motivo para o painel;
 * - sucesso: apaga o motivo gravado.
 * Nunca registra o texto do pedido nem da resposta.
 */
export class ComOrcamento implements ProvedorLLM {
  readonly nome: string;
  private readonly limite: number;
  private readonly relogio: () => Date;

  constructor(
    private readonly provedor: ProvedorLLM,
    private readonly db: Banco,
    opcoes: OpcoesOrcamento = {},
  ) {
    this.nome = provedor.nome;
    this.limite = opcoes.limiteDiario ?? LIMITE_DIARIO_PADRAO;
    this.relogio = opcoes.relogio ?? (() => new Date());
  }

  /** Fila de uma chamada por vez: contagem e registro nunca se cruzam (orcamento atomico). */
  private fila: Promise<unknown> = Promise.resolve();

  perguntar<T>(pedido: PedidoIa<T>): Promise<RespostaIa<T>> {
    const vez = this.fila.then(() => this.perguntarAgora(pedido));
    this.fila = vez.catch(() => undefined);
    return vez;
  }

  private async perguntarAgora<T>(pedido: PedidoIa<T>): Promise<RespostaIa<T>> {
    for (let tentativa = 1; ; tentativa++) {
      const agora = this.relogio();
      if (contarChamadasIa(this.db, new Date(agora.getTime() - UM_DIA_MS)) >= this.limite) {
        const erro = new IaIndisponivelError(
          'orcamento',
          `Limite de ${this.limite} chamadas ao Claude em 24 h atingido.`,
        );
        gravarEstado(this.db, CHAVES_ESTADO.iaIndisponivel, erro.message, agora);
        throw erro;
      }
      try {
        const resposta = await this.provedor.perguntar(pedido);
        registrarChamadaIa(this.db, { tarefa: pedido.tarefa, sucesso: true, duracaoMs: resposta.duracaoMs }, agora);
        apagarEstado(this.db, CHAVES_ESTADO.iaIndisponivel);
        return resposta;
      } catch (erro) {
        registrarChamadaIa(this.db, { tarefa: pedido.tarefa, sucesso: false, erro: resumir(erro) }, agora);
        if (erro instanceof IaIndisponivelError) {
          gravarEstado(this.db, CHAVES_ESTADO.iaIndisponivel, erro.message, agora);
          throw erro;
        }
        if (erro instanceof RespostaIaInvalidaError && tentativa === 1) continue;
        throw erro;
      }
    }
  }
}
