# Riscos e casos especiais

O que pode dar errado e o que o Frank faz. Marque quando estiver tratado e testado.

## 1. Preço

- [ ] O preço muda entre o alerta e a compra → mostrar a hora da última conferência; reconferir antes de avisar (MVP)
- [ ] Tarifa básica sem mala nem assento → comparar sempre com a mala que a pessoa pediu (MVP)
- [ ] Preço por pessoa × total → sempre o total para os passageiros da vigilância (MVP)
- [ ] Tarifa com erro pode ser cancelada pela companhia → etiqueta "possível erro de tarifa: não marque hotel ainda" (fase 2; conferir as regras no Brasil)
- [ ] Parcelamento com juros → mostrar o preço à vista (fase 2)

## 2. Voo

- [ ] Passagens separadas: perdeu a conexão, o problema é seu → etiqueta e opção de nunca aceitar (MVP)
- [ ] Volta ou conexão por outro aeroporto (CGH × GRU × VCP) → etiqueta e filtro "só estes aeroportos" (MVP)
- [ ] Conexão curta ou longa demais → mínimo e máximo nas configurações (MVP)
- [ ] Voo de madrugada → etiqueta e filtro de horário (MVP)
- [ ] Vendido por uma companhia e operado por outra → mostrar quem opera (fase 2)

## 3. Viagem internacional

- [ ] Visto ou autorização no destino e em conexões → aviso "confira se precisa de visto" (fase 3)
- [ ] Validade mínima do passaporte → aviso fixo (fase 3)
- [ ] Moeda e IOF → preço final em reais com IOF somado (MVP)

## 4. Compra

- [ ] Vendedor estrangeiro → lista Onde comprar com etiquetas (MVP)
- [ ] 24 h só valem com 7+ dias de antecedência → mostrar quantos dias faltam e se a regra vale (MVP)
- [ ] Nome diferente do documento → lembrete no alerta (MVP)
- [ ] Milhas podem sair mais baratas → skill de milhas (fase 3)

## 5. Fonte de dados

- [ ] Kiwi fora do ar, mudou o formato ou bloqueou → detectar, avisar no painel; segunda fonte no plano (MVP detecta)
- [ ] Consultar demais e ser bloqueado → intervalo mínimo e teto diário (MVP)
- [ ] Promoção exclusiva do site da companhia não aparece na Kiwi → caçador de promoções e placar medem isso (fase 2)
- [ ] Termos de uso da Kiwi ainda não lidos → ler antes do primeiro push público (fase 0)

## 6. IA

- [ ] A IA inventa um preço → preço sempre da fonte, saída validada por schema (MVP)
- [ ] Página com instrução escondida para a IA → texto de fora é dado (fase 2)
- [ ] Limite do plano do Claude acabou → vigia segue, oferta "sem avaliação" (MVP)
- [ ] Claude fora do ar → mesmo tratamento (MVP)
- [ ] Anthropic muda as regras de uso do plano → acompanhar e registrar no README (contínuo)

## 7. Operação

- [ ] Computador desligado ou hibernando → painel mostra "última checagem há X horas"; README explica como evitar (MVP)
- [ ] Internet cai → tentar de novo depois, sem travar (MVP)
- [ ] Alerta repetido → só de novo se o preço cair mais (MVP)
- [ ] Alerta de madrugada → horário silencioso opcional, desligado por padrão (MVP)
- [ ] Fuso de voo internacional → sempre a hora local de cada aeroporto (MVP)

## 8. Placar

- [ ] Escolher rotas que favorecem o Frank → rotas definidas antes, todas publicadas
- [ ] E-mail do Google atrasado → registrar a hora de chegada, não a hora em que foi visto
- [ ] Comparar preços diferentes → sempre o preço final da mesma viagem

## 9. Projeto público

- [ ] Token ou chave vazando → `.env` fora do git, hook `secret-guard` (fase 0)
- [ ] Dado pessoal no código ou nos prints → dados fictícios, prints revisados antes de postar
- [ ] Alguém perder dinheiro achando que o preço era garantido → aviso no README e no painel
- [ ] Instalação em Windows, macOS e Linux → testar nos três
