# Técnicas de IA no Frank

Cada técnica rende pelo menos um post. A ordem segue a construção.

| # | Técnica | O que é | Onde entra no Frank | Ideia de post |
|---|---|---|---|---|
| 1 | Uso de ferramentas e MCP | a IA chama programas externos; MCP é o padrão de "tomada" pra isso | o Claude consulta a Kiwi pelo conector | "Liguei o Claude numa fonte de passagens com um comando" |
| 2 | Agente autônomo em ciclo | acorda, confere, age e volta a dormir | o vigia | "Um agente que trabalha enquanto você dorme" |
| 3 | Híbrido: código + IA | código simples no repetitivo, IA só onde precisa julgar | vigia sem IA, Claude só no preço fora do normal | "Meu agente roda 30 dias e quase não gasta o plano" |
| 4 | Memória e estado | o agente lembra o que já viu | histórico em SQLite, sem alerta repetido | "Como um agente lembra das coisas" |
| 5 | Detecção de anomalia | estatística pra achar o ponto fora da curva | preço abaixo da mediana da rota | "Nem tudo em IA é ChatGPT" |
| 6 | Skills (engenharia de contexto) | conhecimento em arquivos que vai junto no pedido | pasta `skills/` | "Ensinei o Claude a caçar passagem com arquivos de texto" |
| 7 | Saída estruturada | a IA responde num formato fixo (JSON) validado por schema | pedido vira vigilância; avaliação vira nota e pegadinhas | "Como fazer a IA conversar com um programa" |
| 8 | Planejamento | a IA decide os próprios passos | buscas divididas por companhia e aeroporto | "15 resultados por busca: como o agente contorna o limite" |
| 9 | Ancoragem (grounding) | toda informação vem de fonte conferível | preço sempre da Kiwi, nunca do texto do Claude | "Por que meu agente nunca inventa um preço" |
| 10 | IA como juiz | a IA avalia seguindo um checklist | avaliador de oferta | "A IA que diz se a promoção é cilada" |
| 11 | Humano no circuito | a decisão final fica com a pessoa | o alerta chega e a pessoa compra | "Por que meu agente não compra sozinho" |
| 12 | Avaliação (evals) | medir se o sistema funciona, com regras justas | placar contra o Google; testes das skills com ofertas conhecidas | "30 dias: meu agente contra o Google" |
| 13 | Pesquisa na web e extração | a IA lê páginas e tira só os dados que importam | caçador de promoções | "O agente que lê blog de promoção por mim" |
| 14 | Defesa contra injeção de prompt | texto de site pode esconder ordens para a IA | texto de fora tratado como dado | "Como um site pode sequestrar seu agente" |
