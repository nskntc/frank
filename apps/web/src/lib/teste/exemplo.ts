// Dados ficticios para os testes e os prints do painel (repo publico: nada de viagem real).
import {
  type Banco,
  criarVigilancia,
  type OpcaoCompra,
  registrarOferta,
  registrarPrecosVistos,
  salvarAvaliacao,
  salvarOpcoesCompra,
} from '@frank/banco';
import type { AvaliacaoOferta, Itinerario, NovaVigilancia, Perna } from '@frank/contratos';

const vigilancia = (descricao: string, origens: string[], destinos: string[], volta: boolean): NovaVigilancia => ({
  descricao,
  origens,
  destinos,
  idaDe: '2027-03-01',
  idaAte: '2027-03-31',
  voltaDe: volta ? '2027-03-08' : null,
  voltaAte: volta ? '2027-04-07' : null,
  adultos: 1,
  malasDespachadas: 0,
  maxEscalas: 1,
  companhias: [],
  aceitarPassagensSeparadas: false,
  precoAlvoCentavos: 80_000,
  moeda: 'BRL',
  intervaloMinutos: 60,
});

function perna(de: string, para: string, partida: string, chegada: string, companhia: string, escala?: string): Perna {
  const trechos = escala
    ? [
        { de, para: escala, partida, chegada: `${partida.slice(0, 11)}09:10:00`, companhia, codigoCompanhia: 'XX', numeroVoo: 'XX 1001' },
        { de: escala, para, partida: `${partida.slice(0, 11)}16:20:00`, chegada, companhia, codigoCompanhia: 'XX', numeroVoo: 'XX 1002' },
      ]
    : [{ de, para, partida, chegada, companhia, codigoCompanhia: 'XX', numeroVoo: 'XX 1000' }];
  return {
    de,
    para,
    partida,
    chegada,
    duracaoSegundos: (Date.parse(`${chegada}Z`) - Date.parse(`${partida}Z`)) / 1000,
    escalas: trechos.length - 1,
    trechos,
  };
}

function itinerario(id: string, precoCentavos: number, ida: Perna, volta: Perna | null): Itinerario {
  return {
    fonte: 'kiwi',
    idNaFonte: id,
    precoCentavos,
    moeda: 'BRL',
    linkCompra: `https://www.kiwi.com/u/${id}`,
    malas: { item: 1, mao: 1, despachada: 0 },
    ida,
    volta,
  };
}

interface Exemplo {
  vig: NovaVigilancia;
  it: Itinerario;
  precoFinal: number;
  normal: number | null;
  abaixo: number | null;
  avaliacao: AvaliacaoOferta | null;
  opcoes: OpcaoCompra[];
}

export const EXEMPLOS: readonly Exemplo[] = [
  {
    vig: vigilancia('São Paulo → Recife em março, uma semana, até R$ 800', ['GRU'], ['REC'], true),
    it: itinerario(
      'exemplo-1',
      69_000,
      perna('GRU', 'REC', '2027-03-12T07:05:00', '2027-03-12T10:20:00', 'Companhia Exemplo'),
      perna('REC', 'GRU', '2027-03-19T18:40:00', '2027-03-19T22:05:00', 'Companhia Exemplo'),
    ),
    precoFinal: 71_415,
    normal: 115_000,
    abaixo: 38,
    avaliacao: {
      valeAPena: true,
      pegadinhas: [{ tipo: 'sem_mala_despachada', descricao: 'A tarifa não inclui mala despachada.' }],
      resumo: 'Voos diretos nos dois sentidos e em bons horários; bem abaixo do que essa rota costuma custar.',
    },
    opcoes: [
      { vendedor: 'Kiwi.com', precoCentavos: 69_000, moeda: 'BRL', estrangeiro: true, link: 'https://www.kiwi.com/u/exemplo-1' },
      { vendedor: 'Companhia Exemplo', precoCentavos: 73_500, moeda: 'BRL', estrangeiro: false, ehCompanhia: true, link: 'https://www.google.com/travel/flights?exemplo=1' },
      { vendedor: 'Agência Exemplo', precoCentavos: 75_200, moeda: 'BRL', estrangeiro: false, link: 'https://www.google.com/travel/flights?exemplo=2' },
    ],
  },
  {
    vig: vigilancia('Campinas → Salvador, só ida, qualquer dia de março', ['VCP'], ['SSA'], false),
    it: itinerario(
      'exemplo-2',
      38_990,
      perna('VCP', 'SSA', '2027-03-04T05:10:00', '2027-03-04T19:05:00', 'Aérea Fictícia', 'BSB'),
      null,
    ),
    precoFinal: 40_355,
    normal: 69_000,
    abaixo: 42,
    avaliacao: null,
    opcoes: [],
  },
  {
    vig: vigilancia('Rio → Fortaleza, ida e volta em março', ['GIG'], ['FOR'], true),
    it: itinerario(
      'exemplo-3',
      92_000,
      perna('GIG', 'FOR', '2027-03-20T13:00:00', '2027-03-20T16:25:00', 'Linhas Modelo'),
      perna('FOR', 'SDU', '2027-03-27T09:30:00', '2027-03-27T13:00:00', 'Linhas Modelo'),
    ),
    precoFinal: 95_220,
    normal: 104_000,
    abaixo: 8,
    avaliacao: {
      valeAPena: false,
      pegadinhas: [{ tipo: 'outro_aeroporto', descricao: 'A ida sai de GIG, mas a volta chega em SDU.' }],
      resumo: 'Só um pouco abaixo do normal e a volta chega em outro aeroporto.',
    },
    opcoes: [],
  },
];

/** Grava os exemplos e devolve os ids das ofertas, na ordem de EXEMPLOS. */
export function semearExemplos(db: Banco, vistoEm: Date = new Date()): number[] {
  return EXEMPLOS.map((e) => {
    const vigilanciaId = criarVigilancia(db, e.vig).id;
    const [precoVistoId] = registrarPrecosVistos(db, vigilanciaId, 'r1', [e.it], vistoEm);
    const oferta = registrarOferta(db, {
      vigilanciaId,
      precoVistoId: precoVistoId as number,
      precoFinalCentavos: e.precoFinal,
      moeda: 'BRL',
      precoNormalCentavos: e.normal,
      percentualAbaixo: e.abaixo,
      motivos: ['abaixo_do_alvo', 'abaixo_do_normal'],
    });
    salvarAvaliacao(db, oferta.id, e.avaliacao);
    if (e.opcoes.length) salvarOpcoesCompra(db, oferta.id, e.opcoes);
    return oferta.id;
  });
}
