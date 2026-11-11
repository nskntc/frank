# Frank

Agente de IA que caça passagem aérea barata. Ele fica rodando no seu computador por semanas, vigia
as rotas que você escolheu e avisa quando aparece um preço muito abaixo do normal, com o link pra
comprar.

> **Status: em construção.** Ainda não funciona. Acompanhe pelo [roadmap](docs/ROADMAP.md).

O nome vem do Frank de *Prenda-me se for capaz*, que vivia voando sem pagar. Este aqui só quer
achar a passagem mais barata.

## Como vai funcionar

1. Você descreve a viagem com suas palavras: "São Paulo → Recife, março, até R$ 800".
2. O Claude transforma o pedido em buscas por companhia, aeroporto e data.
3. O vigia confere os preços a cada 30 a 60 minutos, **sem IA**, e guarda tudo num histórico local.
4. Quando um preço foge do normal, o Claude avalia se a oferta é real e se tem pegadinha.
5. A oferta aparece no painel e chega no seu e-mail (ou Telegram), com onde comprar e o preço
   final em cada vendedor.
6. Você compra. No site da companhia, comprando com 7 dias ou mais de antecedência, dá pra desistir
   sem custo em até 24 horas (ANAC, Resolução 400, art. 11).

## Princípios

- **Grátis e aberto.**
- **Roda no seu computador**, com o seu login no Claude Code oficial. O Frank nunca pede nem guarda
  esse login.
- **Preço sempre confirmado:** todo preço vem de uma fonte de preço, nunca de um texto escrito pela IA.
- **Não compra sozinho:** ele avisa, você decide.
- **Gasta pouco do seu plano:** a vigilância roda sem IA; o Claude só entra quando vale a pena.
- **Respeita os sites:** não usa robô em site cujos termos proíbem.

## Requisitos (previstos)

- Node 22 ou mais novo e pnpm 10
- [Claude Code](https://claude.com/claude-code) instalado e logado com um plano do Claude
- Uma conta de e-mail com envio por SMTP (Gmail com senha de app serve) para os avisos; Telegram é
  opcional

## Documentação

| Documento | O que tem |
| --- | --- |
| [Produto](docs/specs/SPEC-PRODUTO.md) | visão, fluxo, telas e regras |
| [MVP](docs/specs/SPEC-01-MVP.md) | requisitos e critérios de aceite |
| [Roadmap](docs/ROADMAP.md) | fases, do zero ao Frank completo |
| [Stack](docs/decisoes/ADR-001-stack.md) | tecnologia escolhida e por quê |
| [Riscos](docs/RISCOS.md) | casos especiais que o Frank precisa tratar |
| [Técnicas de IA](docs/TECNICAS-DE-IA.md) | o que o Frank usa de IA e onde |
| [Diário de testes](docs/DIARIO-DE-TESTES.md) | cada experimento e o que ele ensinou |
| [Diário de conteúdo](docs/CONTEUDO.md) | os momentos da construção que viram post |
| [Como contribuir](CONTRIBUTING.md) | regras para quem mexe no código |

## Aviso

O Frank mostra preços encontrados em fontes públicas. Confira sempre o preço final no site antes de
comprar. Não é consultoria de viagem.

## Licença

[MIT](LICENSE)
