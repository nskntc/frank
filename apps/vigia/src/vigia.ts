import { apagarEstado, CHAVES_ESTADO, gravarEstado } from '@frank/banco';
import { type DependenciasRodada, executarRodada, resumirErro, type ResumoRodada } from './rodada.js';

/** De quanto em quanto tempo o vigia acorda para ver se alguma vigilancia venceu. */
export const TIQUE_PADRAO_MS = 60_000;

/**
 * O laco do vigia: acorda a cada tique, grava o sinal de vida, roda as vigilancias devidas e
 * dorme. Nunca roda duas rodadas ao mesmo tempo. Depois de hibernar, o proximo tique ve as
 * vigilancias vencidas e roda sozinho (RNF-08).
 */
export class Vigia {
  private rodando: Promise<ResumoRodada | null> | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private ligado = false;

  constructor(
    private readonly deps: DependenciasRodada,
    private readonly tiqueMs: number = TIQUE_PADRAO_MS,
    private readonly relogio: () => Date = () => new Date(),
  ) {}

  /** Uma rodada agora. Se ja ha uma rodando, devolve null sem comecar outra. */
  async tique(): Promise<ResumoRodada | null> {
    if (this.rodando) return null;
    this.rodando = this.rodar();
    try {
      return await this.rodando;
    } finally {
      this.rodando = null;
    }
  }

  private async rodar(): Promise<ResumoRodada | null> {
    const agora = this.relogio();
    this.gravarSemLancar(() => gravarEstado(this.deps.db, CHAVES_ESTADO.vigiaVistoEm, agora.toISOString(), agora));
    try {
      const resumo = await executarRodada(this.deps, agora);
      this.gravarSemLancar(() => apagarEstado(this.deps.db, CHAVES_ESTADO.ultimoErroCiclo));
      if (resumo.vigilancias > 0) {
        this.deps.log.info(
          `rodada: ${resumo.vigilancias} vigilância(s), ${resumo.consultas} consulta(s), ` +
            `${resumo.itinerarios} voo(s), ${resumo.ofertas} oferta(s), ${resumo.erros} erro(s), ` +
            `${resumo.puladasPorTeto} pulada(s) por teto`,
        );
      }
      return resumo;
    } catch (erro) {
      // O ciclo inteiro falhou (ex.: banco): fica gravado para o painel, alem do log.
      const mensagem = resumirErro(erro);
      this.deps.log.erro(`rodada falhou: ${mensagem}`);
      this.gravarSemLancar(() => gravarEstado(this.deps.db, CHAVES_ESTADO.ultimoErroCiclo, mensagem, agora));
      return null;
    }
  }

  private gravarSemLancar(gravar: () => void): void {
    try {
      gravar();
    } catch (erro) {
      this.deps.log.erro(`não consegui gravar o estado do vigia: ${resumirErro(erro)}`);
    }
  }

  iniciar(): void {
    if (this.ligado) return;
    this.ligado = true;
    const ciclo = async () => {
      await this.tique();
      if (this.ligado) this.temporizador = setTimeout(ciclo, this.tiqueMs);
    };
    void ciclo();
  }

  /** Para de agendar e espera a rodada em andamento terminar. */
  async parar(): Promise<void> {
    this.ligado = false;
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    if (this.rodando) await this.rodando;
  }
}
