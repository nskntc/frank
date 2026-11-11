# Fase 1 — MVP

**Pronto quando:** uma vigilância real roda 7 dias seguidos sem parar; todo alerta enviado tem o
preço reconferido na fonte; as 5 telas do painel funcionam em 360, 768 e 1280 px; `pnpm verificar`
verde; a corrida contra o Google começou numa rota.

Valores marcados com *(calibrar)* são premissas iniciais, ajustadas com os dados do diário.

## Requisitos funcionais

### Vigilâncias

| Id | Requisito | Aceite |
|---|---|---|
| RF-01 | Criar vigilância a partir de texto livre ("São Paulo → Recife, março, até R$ 800") | o Claude devolve JSON validado (origens, destinos, datas ou janela, passageiros, malas, preço-alvo, filtros); o painel mostra o entendido e só salva depois da confirmação |
| RF-02 | Editar, pausar e apagar vigilância | ações no painel, refletidas no próximo ciclo |
| RF-03 | Filtros: aeroportos aceitos, escalas máximas, horários, aceitar passagens separadas, companhias | cada filtro chega na busca da fonte ou no detector |

### Busca e histórico

| Id | Requisito | Aceite |
|---|---|---|
| RF-04 | Vigia consulta a fonte no intervalo da vigilância | padrão 60 min, mínimo 30 *(calibrar)*; teto diário de consultas por fonte |
| RF-05 | Busca dividida por companhia e aeroporto | uma vigilância São Paulo → Recife traz Azul, LATAM e Gol, não só a primeira |
| RF-06 | Todo preço visto vai para o histórico | hora, fonte, voo, companhia, escalas, malas, preço em centavos |

### Detecção e avaliação

| Id | Requisito | Aceite |
|---|---|---|
| RF-07 | Preço normal da rota | mediana dos últimos 14 dias com no mínimo 20 observações *(calibrar)*. Antes disso, vale a referência do Google Flights (histórico de 60 dias e faixa típica, buscados via SerpApi quando a vigilância é criada); sem chave do SerpApi, só o preço-alvo vale |
| RF-08 | Regra de oferta | preço final ≤ preço-alvo, ou 25% abaixo do normal *(calibrar)* |
| RF-09 | Reconferir antes de avisar | nova consulta na fonte; preço subiu acima da regra, não avisa |
| RF-10 | Avaliação pelo Claude | JSON validado com `valeAPena`, `pegadinhas[]` e `resumo`; preço nunca vem do Claude |
| RF-11 | Claude indisponível ou sem limite | a oferta aparece como "sem avaliação"; o vigia segue |

### Onde comprar

| Id | Requisito | Aceite |
|---|---|---|
| RF-12 | Preço em cada vendedor | quando surge uma oferta, consultar as opções de compra do Google Flights via SerpApi (3 consultas por oferta) e mostrar o preço em cada vendedor (companhia, agências, Kiwi); sem chave do SerpApi ou sem cota, mostrar os links de busca preenchida (LATAM, Gol, Azul, Decolar, testados na issue #1) |
| RF-13 | Preço final e etiquetas | IOF de 3,5% somado em vendedor estrangeiro; etiquetas "24 h para desistir", "empresa estrangeira", "passagens separadas"; teto mensal de consultas ao SerpApi respeitado (plano grátis: 250) |
| RF-14 | Tolerância para comprar direto | configuração "pago até X% a mais na companhia" muda a opção destacada |

### Alertas

| Id | Requisito | Aceite |
|---|---|---|
| RF-15 | Telegram | mensagem com rota, preço final, % abaixo do normal, voo, malas, pegadinhas, link, lembrete das 24 h e do nome igual ao documento |
| RF-16 | Sem repetição | mesma oferta só alerta de novo se o preço cair mais |
| RF-17 | Horário silencioso opcional | desligado por padrão (oferta boa some rápido) |

### Painel e placar

| Id | Requisito | Aceite |
|---|---|---|
| RF-18 | Telas | Ofertas, Rotas vigiadas, Detalhe da rota (gráfico), Placar, Configurações |
| RF-19 | Barra de status | última checagem, erro de fonte, Claude disponível, Telegram configurado |
| RF-20 | Placar | registrar à mão o preço e a hora do alerta do Google por rota e comparar com o Frank |

## Requisitos não funcionais

| Id | Requisito |
|---|---|
| RNF-01 | Roda local; painel escuta só em `127.0.0.1` |
| RNF-02 | Claude só pelo binário oficial `claude -p`; nada de credencial no Frank |
| RNF-03 | Vigia sem IA; orçamento diário de chamadas ao Claude (padrão 30 *(calibrar)*) |
| RNF-04 | Dinheiro em centavos; data de voo `AAAA-MM-DD`; horário com fuso do aeroporto |
| RNF-05 | Falha de fonte, Claude ou Telegram nunca derruba o vigia; vira aviso no painel |
| RNF-06 | Painel minimalista, tema claro e escuro, 360/768/1280 px sem rolagem lateral |
| RNF-07 | Instala em Windows, macOS e Linux só com Node e pnpm (sem Docker) |
| RNF-08 | Computador hibernado não perde estado: o vigia retoma e o painel mostra há quanto tempo parou |
| RNF-09 | Nenhum dado pessoal no repositório |

## Fora do MVP

Caçador de promoções, milhas, painel pelo celular, alerta no WhatsApp, compra automática. Robô nos
sites de companhia e agência está descartado (bloqueiam com 403). Ver [`../ROADMAP.md`](../ROADMAP.md).
