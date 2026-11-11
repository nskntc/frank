import { z } from 'zod';

/**
 * Saida JSON do Claude ao avaliar uma oferta (SPEC-01, RF-10). Nao tem campo de preco, voo ou
 * data de proposito: esses dados vem sempre da fonte, nunca do modelo.
 */
export const tipoPegadinhaSchema = z.enum([
  'passagens_separadas',
  'outro_aeroporto',
  'escala_longa',
  'conexao_curta',
  'voo_madrugada',
  'sem_mala_despachada',
  'vendedor_estrangeiro',
  'possivel_erro_tarifa',
  'outra',
]);

export const avaliacaoOfertaSchema = z
  .object({
    valeAPena: z.boolean(),
    pegadinhas: z
      .array(
        z.object({
          tipo: tipoPegadinhaSchema,
          descricao: z.string().min(1).max(200),
        }),
      )
      .max(10),
    resumo: z.string().min(1).max(300),
  })
  .strict();

export type TipoPegadinha = z.infer<typeof tipoPegadinhaSchema>;
export type AvaliacaoOferta = z.infer<typeof avaliacaoOfertaSchema>;
