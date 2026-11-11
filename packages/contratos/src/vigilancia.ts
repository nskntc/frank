import { lerDia } from '@frank/dominio';
import { z } from 'zod';

/** Dia AAAA-MM-DD que existe no calendario (2027-02-30 e recusado). */
const dia = z.string().refine(
  (valor) => {
    try {
      lerDia(valor);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'dia invalido, use AAAA-MM-DD' },
);

const codigoAeroporto = z.string().regex(/^[A-Z]{3}$/);
const codigoCompanhia = z.string().regex(/^[A-Z0-9]{2,3}$/);

/**
 * O que a pessoa quer vigiar (SPEC-01, RF-01 a RF-03). E tambem o formato que o planejador
 * (Claude) devolve ao entender um pedido em texto livre; o painel confirma antes de salvar.
 * Datas sao janelas: ida entre idaDe e idaAte; volta entre voltaDe e voltaAte (null = so ida).
 */
export const novaVigilanciaSchema = z
  .object({
    descricao: z.string().min(1).max(300),
    origens: z.array(codigoAeroporto).min(1).max(5),
    destinos: z.array(codigoAeroporto).min(1).max(5),
    idaDe: dia,
    idaAte: dia,
    voltaDe: dia.nullable(),
    voltaAte: dia.nullable(),
    adultos: z.number().int().min(1).max(9),
    malasDespachadas: z.number().int().min(0).max(2),
    maxEscalas: z.number().int().min(0).max(3).nullable(),
    /** Vazio = qualquer companhia. */
    companhias: z.array(codigoCompanhia).max(10),
    aceitarPassagensSeparadas: z.boolean(),
    precoAlvoCentavos: z.number().int().positive().nullable(),
    moeda: z.string().regex(/^[A-Z]{3}$/),
    /** SPEC-01 RF-04: padrao 60, minimo 30. */
    intervaloMinutos: z.number().int().min(30).max(1440),
  })
  .strict()
  .refine((v) => v.idaAte >= v.idaDe, { message: 'idaAte antes de idaDe', path: ['idaAte'] })
  .refine((v) => (v.voltaDe === null) === (v.voltaAte === null), {
    message: 'voltaDe e voltaAte vem juntos (ou os dois null, so ida)',
    path: ['voltaAte'],
  })
  .refine((v) => v.voltaDe === null || v.voltaAte === null || v.voltaAte >= v.voltaDe, {
    message: 'voltaAte antes de voltaDe',
    path: ['voltaAte'],
  })
  .refine((v) => v.voltaDe === null || v.voltaDe >= v.idaDe, {
    message: 'volta antes da ida',
    path: ['voltaDe'],
  });

export type NovaVigilancia = z.infer<typeof novaVigilanciaSchema>;

export interface Vigilancia extends NovaVigilancia {
  id: string;
  ativa: boolean;
  /** Instantes ISO em UTC. */
  criadaEm: string;
  atualizadaEm: string;
  /** Precos vistos antes disto nao contam para o preco normal (rota, datas ou filtros mudaram). */
  historicoDesde: string;
  /** Ultima rodada do vigia, com sucesso ou nao. Null = nunca rodou. */
  ultimaRodadaEm: string | null;
  /** Como foi a ultima rodada. Null = nunca rodou (ou formato antigo ilegivel). */
  ultimaRodadaResultado: ResultadoRodadaVigilancia | null;
}

/** Resultado da ultima rodada de uma vigilancia, para o painel mostrar "ultima checagem falhou". */
export interface ResultadoRodadaVigilancia {
  consultas: number;
  itinerarios: number;
  erros: number;
  puladasPorTeto: number;
  /** Mensagem curta do ultimo erro da rodada, sem token nem dado pessoal. */
  ultimoErro: string | null;
}
