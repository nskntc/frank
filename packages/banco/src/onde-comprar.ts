import type { Itinerario } from '@frank/contratos';
import {
  desistencia24h,
  diaNoFuso,
  lerDia,
  montarOndeComprar,
  type OndeComprar,
  type ViagemParaLink,
} from '@frank/dominio';
import type { Banco } from './abrir.js';
import { CONFIGURACOES, lerConfiguracaoNumero } from './configuracoes.js';
import { listarOpcoesCompra, obterOferta } from './ofertas.js';
import { obterPrecoVisto } from './precos.js';
import { obterVigilancia } from './vigilancias.js';

/**
 * A viagem para o link de busca preenchida, so quando o link reproduz o voo da oferta: ida e
 * volta no caminho exatamente inverso. Volta por outro aeroporto (REC -> VCP depois de GRU -> REC)
 * abriria outra viagem, com outro preco: nesse caso vale o link gravado.
 */
function viagemDoLink(itinerario: Itinerario, adultos: number): ViagemParaLink | null {
  const { ida, volta } = itinerario;
  if (!volta || volta.de !== ida.para || volta.para !== ida.de) return null;
  return {
    origem: ida.de,
    destino: ida.para,
    ida: ida.partida.slice(0, 10),
    volta: volta.partida.slice(0, 10),
    adultos,
  };
}

/**
 * "Onde comprar" pronto para a tela e para o aviso (RF-12 a RF-14): opcoes gravadas da oferta +
 * tolerancia da pessoa + datas do voo (links de busca e a regra das 24 h, contada a partir do dia
 * de `hoje` em Brasilia). Null se a oferta nao existe.
 */
export function ondeComprarDaOferta(db: Banco, ofertaId: number, hoje: Date = new Date()): OndeComprar | null {
  const oferta = obterOferta(db, ofertaId);
  if (!oferta) return null;
  const itinerario = obterPrecoVisto(db, oferta.precoVistoId)?.itinerario ?? null;
  const vigilancia = obterVigilancia(db, oferta.vigilanciaId);

  let vale24h = false;
  try {
    // partida e horario local do aeroporto: os 10 primeiros caracteres sao o dia local do embarque.
    if (itinerario) vale24h = desistencia24h(diaNoFuso(hoje), lerDia(itinerario.ida.partida.slice(0, 10))).vale;
  } catch {
    vale24h = false; // data ilegivel: nao promete as 24 h
  }

  return montarOndeComprar(
    listarOpcoesCompra(db, ofertaId).map((o) => ({ ...o, ehCompanhia: o.ehCompanhia ?? false })),
    {
      viagem: itinerario && vigilancia ? viagemDoLink(itinerario, vigilancia.adultos) : null,
      toleranciaPct: lerConfiguracaoNumero(db, CONFIGURACOES.toleranciaCompanhiaPct),
      vale24h,
    },
  );
}
