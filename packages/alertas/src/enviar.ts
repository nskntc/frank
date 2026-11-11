import {
  apagarEstado,
  type Banco,
  CHAVES_ESTADO,
  CONFIGURACOES,
  gravarEstado,
  historicoAvisoCanal,
  lerConfiguracaoNumero,
  menorPrecoJaAvisado,
  type Oferta,
  obterPrecoVisto,
  obterVigilancia,
  ofertasParaAvisar,
  ondeComprarDaOferta,
  registrarAlerta,
} from '@frank/banco';
import type { Itinerario, Vigilancia } from '@frank/contratos';
import { emSilencio, horaNoFuso } from '@frank/dominio';
import type { CanalAlerta, Logger } from './canal.js';
import { montarMensagem } from './mensagem.js';

export interface ContextoAlertas {
  db: Banco;
  canais: readonly CanalAlerta[];
  log: Logger;
}

export interface ResumoAlertas {
  enviados: number;
  falhas: number;
  /** Puladas: vigilancia pausada, ja avisada por preco igual ou menor, ou o Claude disse que nao vale. */
  puladas: number;
  /** Prontas para sair, esperando o fim do horario silencioso. */
  adiadas: number;
  /** Canais que esgotaram as tentativas nesta rodada (fica gravado para o painel). */
  desistidos: number;
}

/** So avisa oferta das ultimas 24 h: preco velho nao vale um aviso. */
const JANELA_MS = 86_400_000;
/** Espera antes de cada tentativa, por canal: na hora, depois de 5 min, depois de 30 min. */
export const ESPERAS_ENTRE_TENTATIVAS_MS = [0, 5 * 60_000, 30 * 60_000] as const;
export const MAX_TENTATIVAS = ESPERAS_ENTRE_TENTATIVAS_MS.length;

function resumir(erro: unknown): string {
  return (erro instanceof Error ? erro.message : String(erro)).slice(0, 200);
}

/** O canal deve tentar agora? Nao se ja entregou, se esgotou as tentativas ou se ainda espera. */
function canalPendente(db: Banco, ofertaId: number, canal: string, agora: Date): boolean {
  const h = historicoAvisoCanal(db, ofertaId, canal);
  if (h.entregue || h.falhas >= MAX_TENTATIVAS) return false;
  if (!h.ultimaFalhaEm) return true;
  const espera = ESPERAS_ENTRE_TENTATIVAS_MS[h.falhas] ?? 0;
  return agora.getTime() - Date.parse(h.ultimaFalhaEm) >= espera;
}

interface Envio {
  oferta: Oferta;
  vigilancia: Vigilancia;
  itinerario: Itinerario;
  fonte: string;
  idNaFonte: string;
  canais: CanalAlerta[];
}

/**
 * Manda os avisos pendentes (RF-15 a RF-17), chamado a cada tique do vigia. Cada canal tem a sua
 * fila: um canal que falha tenta de novo depois de 5 e de 30 minutos, sem atrapalhar o outro.
 * Esgotou: grava "aviso desistido" para o painel. Pula vigilancia pausada, oferta que o Claude
 * julgou "nao vale a pena" e voo ja avisado por preco igual ou menor (RF-16). No horario
 * silencioso, so conta as que estao prontas e guarda para depois (RF-17).
 */
export async function enviarAlertasPendentes(ctx: ContextoAlertas, agora: Date = new Date()): Promise<ResumoAlertas> {
  const resumo: ResumoAlertas = { enviados: 0, falhas: 0, puladas: 0, adiadas: 0, desistidos: 0 };
  if (!ctx.canais.length) return resumo;

  const envios: Envio[] = [];
  for (const oferta of ofertasParaAvisar(ctx.db, new Date(agora.getTime() - JANELA_MS))) {
    const canais = ctx.canais.filter((c) => canalPendente(ctx.db, oferta.id, c.nome, agora));
    if (!canais.length) continue;
    const visto = obterPrecoVisto(ctx.db, oferta.precoVistoId);
    const vigilancia = obterVigilancia(ctx.db, oferta.vigilanciaId);
    const itinerario = visto?.itinerario;
    const jaAvisado =
      visto && vigilancia
        ? menorPrecoJaAvisado(ctx.db, vigilancia.id, visto.fonte, visto.idNaFonte, oferta.moeda, oferta.id)
        : null;
    if (
      !visto ||
      !itinerario ||
      !vigilancia ||
      !vigilancia.ativa ||
      oferta.avaliacao?.valeAPena === false ||
      (jaAvisado !== null && oferta.precoFinalCentavos >= jaAvisado)
    ) {
      resumo.puladas++;
      continue;
    }
    envios.push({ oferta, vigilancia, itinerario, fonte: visto.fonte, idNaFonte: visto.idNaFonte, canais });
  }
  if (!envios.length) return resumo;

  const inicio = lerConfiguracaoNumero(ctx.db, CONFIGURACOES.silencioInicio);
  const fim = lerConfiguracaoNumero(ctx.db, CONFIGURACOES.silencioFim);
  if (emSilencio(horaNoFuso(agora), inicio, fim)) {
    resumo.adiadas = envios.length;
    return resumo;
  }

  for (const e of envios) {
    // Dentro do mesmo laco, outro envio deste voo pode ter acabado de sair por preco menor.
    const jaAvisado = menorPrecoJaAvisado(ctx.db, e.vigilancia.id, e.fonte, e.idNaFonte, e.oferta.moeda, e.oferta.id);
    if (jaAvisado !== null && e.oferta.precoFinalCentavos >= jaAvisado) {
      resumo.puladas++;
      continue;
    }
    const mensagem = montarMensagem({
      vigilancia: e.vigilancia,
      itinerario: e.itinerario,
      precoFinalCentavos: e.oferta.precoFinalCentavos,
      percentualAbaixo: e.oferta.percentualAbaixo,
      avaliacao: e.oferta.avaliacao,
      ondeComprar: ondeComprarDaOferta(ctx.db, e.oferta.id, agora),
      vistoEm: e.oferta.reconferidaEm ?? e.oferta.detectadaEm,
    });

    for (const canal of e.canais) {
      const base = {
        vigilanciaId: e.vigilancia.id,
        ofertaId: e.oferta.id,
        fonte: e.fonte,
        idNaFonte: e.idNaFonte,
        canal: canal.nome,
        precoCentavos: e.oferta.precoFinalCentavos,
        moeda: e.oferta.moeda,
      };
      try {
        await canal.enviar(mensagem);
        registrarAlerta(ctx.db, { ...base, sucesso: true }, agora);
        apagarEstado(ctx.db, CHAVES_ESTADO.erroAviso(canal.nome));
        resumo.enviados++;
        ctx.log.info(`aviso enviado por ${canal.nome}: ${mensagem.assunto}`);
      } catch (erro) {
        const motivo = resumir(erro);
        registrarAlerta(ctx.db, { ...base, sucesso: false, erro: motivo }, agora);
        gravarEstado(ctx.db, CHAVES_ESTADO.erroAviso(canal.nome), motivo, agora);
        resumo.falhas++;
        const falhas = historicoAvisoCanal(ctx.db, e.oferta.id, canal.nome).falhas;
        if (falhas >= MAX_TENTATIVAS) {
          resumo.desistidos++;
          gravarEstado(ctx.db, CHAVES_ESTADO.avisoDesistido, `${canal.nome}: ${mensagem.assunto} (${motivo})`, agora);
          ctx.log.erro(`desisti do aviso por ${canal.nome} depois de ${falhas} tentativas: ${motivo}`);
        } else {
          ctx.log.aviso(`aviso por ${canal.nome} falhou (tentativa ${falhas} de ${MAX_TENTATIVAS}): ${motivo}`);
        }
      }
    }
  }
  return resumo;
}
