# Diário de testes

Cada experimento vira uma linha, mais nova primeiro. Preços são da rota de teste, nunca de viagem
real de quem usa.

| Data | Teste | Resultado | Aprendizado | Virou post? |
|---|---|---|---|---|
| 2026-11-11 | Robô (navegador automático) abrindo links de busca preenchida na LATAM, Gol, Azul e Decolar, uma carga por site | os 4 responderam 403 / Access Denied antes de mostrar a página | Esses sites bloqueiam robô: preço só pela Kiwi; os links do painel são abertos por quem usa, no próprio navegador (teste manual na issue #1) | não |
| 2026-11-11 | Leitura dos termos de uso da Kiwi (versão de 2026-06-30) | não falam de acesso automático, API nem do conector MCP; o mais próximo: 2.6.4 (não interferir no site), 2.6.7 (sem uso comercial), 6.3 (base de dados reservada); nenhum limite de consultas publicado | Uso pessoal e grátis parece dentro do pretendido, mas não está escrito; decisão em aberto na issue #2 | não |
| 2026-11-11 | Busca por documentação dos links de busca preenchida (LATAM, Gol, Azul, Decolar) | nenhum formato documentado publicamente | Precisa de teste manual em cada site (issue #1) | não |
| 2026-11-11 | Adaptador `KiwiMcp` do Frank ao vivo, São Paulo → Recife, 2027-03-12 a 2027-03-19 | passou: itinerários lidos, validados e com preço em centavos | O preço da Kiwi vem com casas decimais (1092.0) e os horários sem fuso: a conversão fica no adaptador | não |
| 2026-11-10 | Kiwi, São Paulo → Recife, ida 2027-03-12 e volta 2027-03-19, só LATAM e depois só Gol | LATAM a partir de R$ 1.528; Gol a partir de R$ 1.264 | A Kiwi tem as três grandes, mas é preciso buscar por companhia | não |
| 2026-11-10 | Kiwi, mesma rota, sem filtro | 15 resultados em cerca de 5 s, todos da Azul; mais barato R$ 1.092, com volta por Viracopos | Limite de 15 resultados por busca; conector sem chave | não |
| 2026-11-10 | Busca comum na web pelo mesmo voo | nenhum preço para a data pedida, só "a partir de" e datas vizinhas | Busca na web não serve como fonte de preço | não |
