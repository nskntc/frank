# Diário de testes

Cada experimento vira uma linha, mais nova primeiro. Preços são da rota de teste, nunca de viagem
real de quem usa.

| Data | Teste | Resultado | Aprendizado | Virou post? |
|---|---|---|---|---|
| 2026-11-11 | Vigia de ponta a ponta: uma vigilância (GRU e CGH → REC, 2027-03-12 a 2027-03-19) num banco temporário, vigia ligado contra a Kiwi de verdade | 1 rodada, 2 consultas, 30 voos gravados com a mesma rodada; mais barato R$ 1.121 (Azul, CGH) | O ciclo inteiro funciona; no Windows, sinal enviado por outro programa não para o vigia (Ctrl+C no terminal para) | não |
| 2026-11-11 | SerpApi (Google Flights), São Paulo (GRU, CGH, VCP) → Recife, 2027-03-12 a 2027-03-19: busca, volta e opções de compra (3 consultas) | menor ida e volta R$ 975 (Azul, por VCP); faixa típica R$ 910 a R$ 1.700; **histórico de 60 dias** junto da busca. Opções de compra do voo LATAM: 12 vendedores, LATAM direto R$ 1.195 (o mais barato), Zupper R$ 1.196, Booking.com R$ 1.212, Decolar R$ 1.314, **Kiwi R$ 1.372** | O site da companhia ganhou da Kiwi por R$ 177 (15%) no mesmo voo: "Onde comprar" é essencial. O histórico de 60 dias resolve o preço normal antes de o Frank ter histórico próprio. Custo: 3 das 250 consultas grátis do mês por oferta completa | não |
| 2026-11-11 | Links de busca preenchida abertos por pessoa no navegador (rota de teste) | os 4 funcionaram: LATAM, Azul e Decolar com rota e datas; a Gol abriu a busca a partir de Congonhas. Falta só escolher o voo e aceitar cookies | Os links do "Onde comprar" funcionam; formatos registrados na issue #1 | não |
| 2026-11-11 | Robô (navegador automático) abrindo links de busca preenchida na LATAM, Gol, Azul e Decolar, uma carga por site | os 4 responderam 403 / Access Denied antes de mostrar a página | Esses sites bloqueiam robô: preço só pela Kiwi; os links do painel são abertos por quem usa, no próprio navegador (teste manual na issue #1) | não |
| 2026-11-11 | Leitura dos termos de uso da Kiwi (versão de 2026-06-30) | não falam de acesso automático, API nem do conector MCP; o mais próximo: 2.6.4 (não interferir no site), 2.6.7 (sem uso comercial), 6.3 (base de dados reservada); nenhum limite de consultas publicado | Uso pessoal e grátis parece dentro do pretendido, mas não está escrito; decisão em aberto na issue #2 | não |
| 2026-11-11 | Busca por documentação dos links de busca preenchida (LATAM, Gol, Azul, Decolar) | nenhum formato documentado publicamente | Precisa de teste manual em cada site (issue #1) | não |
| 2026-11-11 | Adaptador `KiwiMcp` do Frank ao vivo, São Paulo → Recife, 2027-03-12 a 2027-03-19 | passou: itinerários lidos, validados e com preço em centavos | O preço da Kiwi vem com casas decimais (1092.0) e os horários sem fuso: a conversão fica no adaptador | não |
| 2026-11-10 | Kiwi, São Paulo → Recife, ida 2027-03-12 e volta 2027-03-19, só LATAM e depois só Gol | LATAM a partir de R$ 1.528; Gol a partir de R$ 1.264 | A Kiwi tem as três grandes, mas é preciso buscar por companhia | não |
| 2026-11-10 | Kiwi, mesma rota, sem filtro | 15 resultados em cerca de 5 s, todos da Azul; mais barato R$ 1.092, com volta por Viracopos | Limite de 15 resultados por busca; conector sem chave | não |
| 2026-11-10 | Busca comum na web pelo mesmo voo | nenhum preço para a data pedida, só "a partir de" e datas vizinhas | Busca na web não serve como fonte de preço | não |
