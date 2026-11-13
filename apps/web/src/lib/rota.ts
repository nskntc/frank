import { detectarPegadinhas } from '@frank/agente';
import {
  type Banco,
  jaViuVoo,
  listarReferencias,
  maisBaratoPorDia,
  menoresPorRodada,
  obterVigilancia,
  serieDaVigilancia,
  ultimaRodada,
} from '@frank/banco';
import type { Itinerario, Vigilancia } from '@frank/contratos';
import { type Centavos, DETECTOR_PADRAO, diaNoFuso, mediana, precoNormal } from '@frank/dominio';
import { FONTES, linkSeguro } from './ofertas';
import { type Situacao, situacaoDaRota } from './situacao';

const DIA_MS = 86_400_000;

/** Um ponto no grafico: instante em ms e preco. */
export interface Ponto {
  t: number;
  precoCentavos: Centavos;
}

export interface LinhaDoDia {
  dia: string;
  frank: Centavos | null;
  google: Centavos | null;
  /** Link (so https) do voo mais barato que o Frank viu no dia. */
  link: string | null;
}

/** Um voo da ultima checagem, pronto para a tela: nao e oferta, so o mais barato do momento. */
export interface VooNaTela {
  chave: string;
  itinerario: Itinerario;
  precoCentavos: Centavos;
  vendedor: string;
  estrangeiro: boolean;
  link: string | null;
  vistoEm: string;
  pegadinhas: string[];
}

/** Quantos voos o "Mais barato agora" mostra. */
export const VOOS_AGORA = 3;

export interface DetalheRota {
  vigilancia: Vigilancia;
  /** Menor preco de cada checagem do Frank. */
  frank: Ponto[];
  /** Referencia diaria do Google Flights (meio-dia de Brasilia de cada dia). */
  google: Ponto[];
  /** O mesmo preco normal que o vigia usa (RF-07): o proprio, senao o do Google, senao nenhum. */
  normal: { centavos: Centavos; base: 'proprio' | 'google' } | null;
  /** Para a tabela: um dia por linha, do mais novo ao mais antigo. */
  dias: LinhaDoDia[];
  /** Os mais baratos da ultima checagem (sempre ha onde clicar, mesmo sem oferta). */
  agora: VooNaTela[];
  /** Nunca rodou, falhou, nao achou voo ou ok (issue #22). */
  situacao: Situacao;
}

function meioDiaEmBrasilia(dia: string): number {
  return Date.parse(`${dia}T12:00:00-03:00`);
}

function normalDaRota(
  db: Banco,
  v: Vigilancia,
  google: Ponto[],
  agora: Date,
): DetalheRota['normal'] {
  const desde = new Date(agora.getTime() - DETECTOR_PADRAO.janelaNormalDias * DIA_MS);
  const proprio = precoNormal(menoresPorRodada(db, v.id, desde, v.moeda));
  if (proprio !== null) return { centavos: proprio, base: 'proprio' };

  const limite = agora.getTime() - DETECTOR_PADRAO.janelaReferenciaDias * DIA_MS;
  const recentes = google.filter((p) => p.t >= limite).map((p) => p.precoCentavos);
  if (recentes.length < DETECTOR_PADRAO.minimoPontosReferencia) return null;
  const m = mediana(recentes);
  return m === null ? null : { centavos: Math.round(m), base: 'google' };
}

function porDia(
  frank: Ponto[],
  google: Ponto[],
  links: ReadonlyMap<string, string | null>,
): LinhaDoDia[] {
  const dias = new Map<string, LinhaDoDia>();
  const linha = (dia: string) => {
    let l = dias.get(dia);
    if (!l) {
      l = { dia, frank: null, google: null, link: links.get(dia) ?? null };
      dias.set(dia, l);
    }
    return l;
  };
  for (const p of frank) {
    const l = linha(diaNoFuso(new Date(p.t)));
    l.frank = l.frank === null ? p.precoCentavos : Math.min(l.frank, p.precoCentavos);
  }
  for (const p of google) linha(diaNoFuso(new Date(p.t))).google = p.precoCentavos;
  return [...dias.values()].sort((a, b) => b.dia.localeCompare(a.dia));
}

/** Os mais baratos da ultima checagem, sem repetir o mesmo voo, na moeda da rota. */
function voosAgora(db: Banco, v: Vigilancia): VooNaTela[] {
  const vistos = new Set<string>();
  const voos: VooNaTela[] = [];
  for (const p of ultimaRodada(db, v.id)) {
    const it = p.itinerario;
    const chave = `${p.fonte}:${p.idNaFonte}`;
    if (!it || p.moeda !== v.moeda || vistos.has(chave)) continue;
    vistos.add(chave);
    const fonte = FONTES[p.fonte];
    voos.push({
      chave,
      itinerario: it,
      precoCentavos: p.precoCentavos,
      vendedor: fonte?.nome ?? p.fonte,
      estrangeiro: fonte?.estrangeira ?? false,
      link: linkSeguro(it.linkCompra),
      vistoEm: p.vistoEm,
      pegadinhas: detectarPegadinhas({
        itinerario: it,
        vigilancia: v,
        vendedorEstrangeiro: false, // aparece ao lado do vendedor
        percentualAbaixo: null,
      }).map((x) => x.descricao),
    });
    if (voos.length === VOOS_AGORA) break;
  }
  return voos;
}

/** Tudo que a tela de detalhe da rota mostra (RF-18). Null se a vigilancia nao existe. */
export function detalheDaRota(db: Banco, id: string, agora: Date = new Date()): DetalheRota | null {
  const vigilancia = obterVigilancia(db, id);
  if (!vigilancia) return null;

  const frank = serieDaVigilancia(db, id, vigilancia.moeda).map((p) => ({
    t: Date.parse(p.em),
    precoCentavos: p.precoCentavos,
  }));
  const google = listarReferencias(db, id, vigilancia.moeda)
    .filter((r) => r.fonte === 'google')
    .map((r) => ({ t: meioDiaEmBrasilia(r.dia), precoCentavos: r.precoCentavos }))
    .filter((p) => !Number.isNaN(p.t));

  return {
    vigilancia,
    frank,
    google,
    normal: normalDaRota(db, vigilancia, google, agora),
    dias: porDia(
      frank,
      google,
      new Map(
        maisBaratoPorDia(db, id, vigilancia.moeda).map((p) => [
          p.dia,
          linkSeguro(p.itinerario?.linkCompra),
        ]),
      ),
    ),
    agora: voosAgora(db, vigilancia),
    situacao: situacaoDaRota(vigilancia, jaViuVoo(db, id)),
  };
}
