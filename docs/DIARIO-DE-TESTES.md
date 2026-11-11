# Diário de testes

Cada experimento vira uma linha, mais nova primeiro. Preços são da rota de teste, nunca de viagem
real de quem usa.

| Data | Teste | Resultado | Aprendizado | Virou post? |
|---|---|---|---|---|
| 2026-11-11 | Adaptador `KiwiMcp` do Frank ao vivo, São Paulo → Recife, 2027-03-12 a 2027-03-19 | passou: itinerários lidos, validados e com preço em centavos | O preço da Kiwi vem com casas decimais (1092.0) e os horários sem fuso: a conversão fica no adaptador | não |
| 2026-11-10 | Kiwi, São Paulo → Recife, ida 2027-03-12 e volta 2027-03-19, só LATAM e depois só Gol | LATAM a partir de R$ 1.528; Gol a partir de R$ 1.264 | A Kiwi tem as três grandes, mas é preciso buscar por companhia | não |
| 2026-11-10 | Kiwi, mesma rota, sem filtro | 15 resultados em cerca de 5 s, todos da Azul; mais barato R$ 1.092, com volta por Viracopos | Limite de 15 resultados por busca; conector sem chave | não |
| 2026-11-10 | Busca comum na web pelo mesmo voo | nenhum preço para a data pedida, só "a partir de" e datas vizinhas | Busca na web não serve como fonte de preço | não |
