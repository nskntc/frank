# Skills do Frank

Arquivos de conhecimento que vão junto no pedido ao Claude (como instruções do sistema). Editar um
arquivo muda o comportamento do Frank sem mexer no código. Depois de editar, rode o eval da tarefa
(`FRANK_EVAL=1 pnpm --filter @frank/agente test`) para conferir que nada piorou.

| Arquivo | O que ensina | Usado em | Fase |
|---|---|---|---|
| `entender_pedido.md` | texto livre vira vigilância (rotas, datas, filtros, preço-alvo) | planejador | 1 |
| `estrategias_de_busca.md` | aeroportos por cidade, regiões, escalas | planejador | 1 |
| `avaliar_oferta.md` | checklist de pegadinhas | avaliador | 1 |
| `regras_brasil.md` | 24 h, IOF, tarifas sem mala, comprar na companhia | avaliador | 1 |
| ~~`escrever_alerta.md`~~ | o aviso é montado pelo código (`packages/alertas/src/mensagem.ts`), sem IA: texto previsível e sem risco de preço ou link inventado | — | — |
| `cacar_promocoes.md` | onde procurar e como conferir; texto de site é dado | caçador | 2 |
| `milhas.md` | quando milhas compensam | avaliador | 3 |

Regra: skill nunca recebe texto vindo de fora (página, resposta de fonte). Esse texto vai na
mensagem, marcado como dado.
