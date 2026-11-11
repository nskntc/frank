# Roadmap

Cada fase termina com algo que roda e com conteúdo publicado sobre o que foi aprendido.

| Fase | Entrega | Pronto quando | Conteúdo |
|---|---|---|---|
| 0. Fundação | repositório, docs, metodologia do Claude, esqueleto do monorepo, CI, cliente da Kiwi com teste | `pnpm verificar` verde no CI; uma busca real na Kiwi passa pelo adaptador | "Comecei um agente que caça passagem" · "Liguei o Claude numa fonte de passagens" |
| 1. MVP | vigia, histórico, detector, planejador e avaliador com o Claude, painel com 5 telas, Telegram, links de Onde comprar, placar manual | ver [`specs/SPEC-01-MVP.md`](specs/SPEC-01-MVP.md) | "Um agente que trabalha enquanto você dorme" · "Por que meu agente nunca inventa um preço" |
| 2. Corrida | 30 dias contra o alerta do Google em rotas definidas antes; caçador de promoções; preço por vendedor via SerpApi; defesa contra injeção de prompt | resultado da corrida publicado, com as rotas em que o Google ganhou | "30 dias: meu agente contra o Google" · "Como um site pode sequestrar seu agente" |
| 3. Expansão | milhas ou dinheiro; painel pelo celular; segunda fonte de preço; navegador no site da companhia (só se os termos permitirem) | cada item com teste e entrada no diário | "Milhas ou dinheiro: o agente decide" |
| Talvez | alerta no WhatsApp; compra automática (Duffel) | só se a corrida mostrar que o aviso chega tarde demais | |

## Fase 0 — cards

Feito em 2026-11-11:

- [x] Repositório criado, README, licença MIT, CONTRIBUTING
- [x] `.claude` adaptado do JN: CLAUDE.md, settings, hooks `secret-guard` e `stop-check`, agentes
      revisores, skill `verificacao`
- [x] Specs de produto e MVP, roadmap, ADR-001 (stack), riscos, técnicas de IA, diário de testes

- [x] Stack confirmada (ADR-001); tarefas no GitHub Issues e trabalho direto na `main` (ADR-002)
- [x] Esqueleto do monorepo: `apps/web`, `apps/vigia`, `packages/dominio`, `packages/fontes`,
      `packages/contratos`, `packages/config`; `pnpm verificar` verde (62 testes)
- [x] CI no GitHub Actions (lint, typecheck, testes, build), roda no primeiro push
- [x] `packages/fontes`: adaptador `KiwiMcp` com teste contra resposta gravada; teste ao vivo
      passou em 2026-11-11
- [x] `packages/dominio`: datas, centavos, mediana, detector de oferta, preço final com IOF,
      regra das 24 h
- [x] Painel com as 4 telas navegáveis em estado vazio, conferido em 360/768/1280 px, claro e escuro

A fazer:

1. Criar o repositório no GitHub e o primeiro push (CI verde lá)
2. Ler os termos de uso da Kiwi e registrar a conclusão no diário
3. Testar quais sites de companhia e agência aceitam link de busca preenchido
4. Abrir as issues da Fase 1 a partir da [SPEC-01](specs/SPEC-01-MVP.md)
