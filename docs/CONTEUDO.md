# Diário de conteúdo

Momentos da construção do Frank que viram post: o fato, a prova e o que ensina. Mais novo primeiro.
A pauta por técnica de IA fica em [`TECNICAS-DE-IA.md`](TECNICAS-DE-IA.md); os experimentos, em
[`DIARIO-DE-TESTES.md`](DIARIO-DE-TESTES.md).

Status: **pauta** (ideia anotada) · **rascunho** · **publicado** (com link).

| Data | Momento | Prova | O que ensina | Status |
|---|---|---|---|---|
| 2026-11-11 | O segundo agente revisor (caçador de falhas silenciosas) achou que, se a Kiwi batesse o limite diário ou o vigia caísse, o painel continuaria dizendo "tudo certo". Corrigido com sinal de vida e resultado de cada rodada gravados | issue #4 | Num agente que roda sozinho por semanas, o pior erro é o silencioso: ele para e ninguém sabe | pauta |
| 2026-11-11 | Primeira rodada de verdade: o vigia acordou, consultou a Kiwi duas vezes e gravou 30 voos sozinho | diário de testes, issue #4 | O "agente que trabalha enquanto você dorme" começando a funcionar | pauta |
| 2026-11-11 | Um agente revisor, criado só para revisar dados, achou erros que 97 testes não pegavam: o "preço normal" contava cada voo como uma observação, então uma busca só já passava do mínimo de 20 e voos caros inflavam a média (falsos "25% abaixo do normal") | issue #3, commit `3fa9b78` | Teste confirma o que você pensou; revisor independente acha o que você não pensou | pauta |
| 2026-11-11 | No mesmo voo LATAM, o site da LATAM custava R$ 1.195 e a Kiwi R$ 1.372 (15% a mais, antes do IOF); 12 vendedores com preços diferentes | diário de testes, issue #18 | O agente não pode só achar o voo: precisa dizer onde comprar | pauta |
| 2026-11-11 | O Google Flights entrega 60 dias de histórico de preço da rota junto da busca | diário de testes | Resolver o "começo frio": o agente sabe o que é preço normal no dia 1 | pauta |
| 2026-11-11 | Tentei usar robô nos sites da LATAM, Gol, Azul e Decolar: os quatro barraram na porta (403) | issue #1, diário | Os sites protegem os preços; a força está em pensar e insistir, não em raspar site | pauta |
| 2026-11-11 | Os links de busca já preenchida funcionaram nos quatro sites | issue #1 | Um clique do alerta até a busca certa, sem robô | pauta |
| 2026-11-11 | O primeiro commit tem uma trava que impede subir senha ou token pro GitHub (testada com um token falso do Telegram) | `.claude/hooks/secret-guard.js` | Projeto público: segurança desde o commit 1 | pauta |
| 2026-11-11 | Metodologia de outro projeto (JN) reaproveitada: regras para o Claude, agentes revisores, verificação antes de "pronto" | `.claude/` | Como organizar o Claude Code num projeto de verdade | pauta |
| 2026-11-10 | A Kiwi devolve só 15 voos por busca: sem filtro, só apareceu a Azul; LATAM e Gol só buscando por companhia | diário de testes | Limite de ferramenta muda o desenho do agente (planejamento) | pauta |
| 2026-11-10 | Perguntei o preço de uma passagem numa busca comum na web: só veio "a partir de" e datas vizinhas | diário de testes | IA com busca na web não é fonte de preço | pauta |
| 2026-11-10 | Os termos do Claude Code permitem rodar um agente com o seu próprio plano no seu computador; proíbem apps que pedem o seu login | `docs/specs/SPEC-PRODUTO.md` | Dá para fazer um agente grátis, desde que cada pessoa rode o seu | pauta |
| 2026-11-10 | O Google lançou rastreio de preço com IA em 180+ países: por que construir mesmo assim | pesquisa de mercado (documento de estrutura) | Diferencial não é a busca, é o que o agente faz com ela | pauta |
