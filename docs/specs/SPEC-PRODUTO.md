# Frank — Spec do produto

Atualizada em 2026-11-11.

## O que é

Um agente gratuito e aberto que roda no computador de cada pessoa, vigia rotas aéreas por semanas
e avisa quando aparece um preço muito abaixo do normal. Usa o plano do Claude da própria pessoa,
pelo Claude Code oficial.

**A vantagem não é buscar melhor que o Google numa busca só.** É ficar olhando o tempo todo e
pegar o momento em que um preço baixo aparece (promoção relâmpago, tarifa com erro), coisa que uma
pessoa não consegue.

## Métrica principal

Corrida de 30 dias contra o alerta de preço do Google Flights, na mesma rota, ligados no mesmo dia.
Ganha quem avisar primeiro o menor preço **real**. Regras da corrida em
[`../RISCOS.md`](../RISCOS.md#8-placar) e na seção Placar abaixo.

## Fluxo

1. A pessoa descreve a viagem no painel, com suas palavras
2. O Claude transforma o pedido em vigilâncias: rotas, datas ou janela, passageiros, malas,
   preço-alvo, filtros. O painel mostra o que ele entendeu antes de salvar
3. O vigia consulta as fontes a cada 30 a 60 minutos, **sem IA**, e grava cada preço no histórico
4. O detector compara com o preço normal da rota e com o preço-alvo
5. Preço fora do normal: reconfere na fonte e chama o Claude para avaliar (é real? tem pegadinha?)
6. Oferta confirmada aparece no painel e vai para o Telegram, com onde comprar
7. A pessoa compra no site que escolher

## Componentes

| Componente | O que faz | Usa IA? |
|---|---|---|
| Vigia | consulta as fontes no intervalo de cada vigilância | não |
| Fontes de preço | adaptadores atrás de `FontePreco`; Kiwi primeiro | não |
| Histórico | SQLite local: vigilâncias, preços vistos, ofertas, alertas, placar | não |
| Detector | preço normal (mediana do histórico) e regra de oferta | não, é estatística |
| Planejador | pedido em linguagem normal vira vigilâncias e buscas | sim |
| Avaliador | confere se a oferta é real e quais são as pegadinhas | sim |
| Onde comprar | preço final por vendedor, com IOF e etiquetas | não |
| Alertas | Telegram, atrás de `CanalAlerta` | não |
| Painel | telas no navegador, só em `127.0.0.1` | não |
| Placar | registro da corrida contra o Google | não |
| Caçador de promoções (fase 2) | lê blogs e anúncios de promoção e confere na fonte | sim |

## Telas do painel

| Tela | O que mostra |
|---|---|
| Ofertas (inicial) | ofertas confirmadas, da mais barata pra mais cara: rota, preço final, quanto abaixo do normal, companhia, datas e horários, malas, pegadinhas e **Onde comprar** |
| Rotas vigiadas | vigilâncias ativas e o campo para criar uma nova em linguagem normal |
| Detalhe da rota | gráfico do preço ao longo do tempo, com o preço normal e o preço-alvo |
| Placar | a corrida contra o Google, com campo para registrar o preço visto no Google |
| Configurações | Telegram, frequência, preço-alvo padrão, tolerância para comprar direto, horário silencioso |

Barra de status em todas as telas: última checagem, fonte com erro, Claude disponível ou não.

## Onde comprar

A Kiwi é o radar: descobre o momento, o voo e a data. Nem sempre é o melhor lugar para comprar.

| Vendedor | A favor | Contra |
|---|---|---|
| Site da companhia | 24 h para desistir (compra com 7+ dias de antecedência), atendimento direto | nem sempre o mais barato |
| Agência brasileira | às vezes mais barata, atendimento em português, CDC | taxa, remarcação pela agência, regra de desistência de cada uma |
| Kiwi | às vezes a mais barata; junta companhias que não vendem juntas | empresa estrangeira (IOF de 3,5% no cartão), passagens separadas, reclamações de reembolso |

- MVP: **preço em cada vendedor** pelas "opções de compra" do Google Flights via SerpApi, chamado só
  quando há oferta. No teste de 2026-11-11, o mesmo voo LATAM custava R$ 1.195 no site da LATAM e
  R$ 1.372 na Kiwi
- Sem chave ou sem cota do SerpApi: **links prontos** para a mesma busca na LATAM, Gol, Azul e
  Decolar (os quatro testados e funcionando)
- Configuração: "pago até X% a mais para comprar direto na companhia"

## Alerta no Telegram

Curto, com: rota, preço final, quanto abaixo do normal, voo e horários, malas, pegadinhas, link,
lembrete das 24 h e "nome igual ao documento". Não repete a mesma oferta, só se o preço cair mais.

## Placar

1. Mesmo momento: agente e Google conferidos com poucos minutos de diferença
2. Mesma viagem: a flexibilidade que o Frank usar, o Google também recebe
3. Preço final com taxas, conferido até a tela de pagamento, sem pagar
4. Só vale se o link abrir e o preço se mantiver
5. Tudo registrado: print do Google, link do Frank, horário
6. Rotas definidas antes de começar e todas publicadas

O lado do Google é registrado à mão (robô no Google Flights viola os termos).

## Fontes e serviços

| Serviço | Para quê | Custo | Fase |
|---|---|---|---|
| Kiwi.com (MCP, `https://mcp.kiwi.com`) | preços e link de compra | grátis, sem limites publicados | MVP |
| Claude Code (`claude -p`) | planejador e avaliador | plano da pessoa | MVP |
| Telegram Bot API | aviso no celular | grátis | MVP |
| SerpApi (Google Flights) | preço por vendedor; histórico de 60 dias da rota | 250 consultas/mês grátis | MVP (opcional) |
| Busca na web do Claude | caçador de promoções | plano da pessoa | Fase 2 |
| Travelpayouts (Data API) | preço típico antes de existir histórico | grátis | talvez |
| Duffel | compra automática | US$ 3 por pedido | fora de escopo por ora |

O acesso gratuito do Amadeus para desenvolvedores fechou em 2026-07-17.

## Regras do Brasil

- Desistência sem custo em 24 h, se a compra foi feita com 7 dias ou mais de antecedência (ANAC,
  Resolução 400, art. 11). Há decisões aplicando os 7 dias do CDC a compras online; a Justiça está
  dividida
- IOF de 3,5% em compra com cartão em vendedor estrangeiro, mesmo cobrando em reais
- Tarifas básicas sem mala despachada: o preço comparado inclui a mala que a pessoa pediu

## Uso do plano do Claude

A página de termos do Claude Code proíbe que apps ofereçam login do Claude, guardem credenciais ou
passem pedidos de usuários pelo plano deles, e diz que isso não impede alguém de entrar no binário
oficial do Claude Code com a própria assinatura. O Frank segue esse modelo: cada pessoa instala,
faz login no Claude Code e o Frank chama esse binário. Os limites do plano pressupõem uso normal e
individual, por isso o vigia não usa IA.

Fontes: [termos do Claude Code](https://code.claude.com/docs/en/legal-and-compliance),
[Agent SDK e o plano](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan).

## Decisões em aberto

- [ ] Termos de uso da Kiwi permitem consultas automáticas frequentes?
- [ ] Quais sites de companhia e agência aceitam link de busca preenchido
- [ ] Parâmetros do detector (janela da mediana, % abaixo do normal) a calibrar com dados reais
