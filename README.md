# Frank

Agente de IA que caça passagem aérea barata. Ele fica rodando no seu computador por semanas, vigia
as rotas que você escolheu e avisa quando aparece um preço muito abaixo do normal, com o link pra
comprar.

> **Status: MVP em teste.** Já funciona de ponta a ponta. Ainda pode ter arestas: se algo der
> errado, [abra uma issue](https://github.com/nskntc/frank/issues). Próximos passos no
> [roadmap](docs/ROADMAP.md).

O nome vem do Frank de _Prenda-me se for capaz_, que vivia voando sem pagar. Este aqui só quer
achar a passagem mais barata.

## Como funciona

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
- **Preço sempre confirmado:** todo preço vem de uma fonte de preço, nunca de um texto escrito pela
  IA.
- **Não compra sozinho:** ele avisa, você decide.
- **Gasta pouco do seu plano:** a vigilância roda sem IA; o Claude só entra quando vale a pena.
- **Respeita os sites:** não usa robô em site cujos termos proíbem.

## O que você precisa

| O quê                                              | Para quê                                     | Custo                        |
| -------------------------------------------------- | -------------------------------------------- | ---------------------------- |
| [Node.js](https://nodejs.org) 22.13 ou mais novo   | rodar o Frank                                | grátis                       |
| pnpm 10                                            | instalar as peças do Frank                   | grátis                       |
| [Git](https://git-scm.com)                         | baixar e atualizar o Frank                   | grátis                       |
| [Claude Code](https://claude.com/claude-code)      | entender o pedido e avaliar as ofertas       | o seu plano do Claude        |
| Uma conta de e-mail com SMTP (Gmail serve)         | receber os avisos                            | grátis                       |
| Telegram (opcional)                                | receber os avisos também no celular          | grátis                       |
| Chave da [SerpApi](https://serpapi.com) (opcional) | preço em cada vendedor e histórico do Google | grátis até 250 consultas/mês |

Funciona em Windows, macOS e Linux. O Frank só usa a internet para consultar preços e mandar os
avisos; o painel abre só no seu computador (`127.0.0.1`), ninguém de fora acessa.

## Instalação

Os comandos vão num terminal: no Windows, o **PowerShell** (procure "PowerShell" no menu Iniciar);
no macOS, o app **Terminal**; no Linux, o terminal da sua distribuição.

### 1. Node.js e pnpm

**Windows**

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```

Feche e abra o PowerShell de novo, e depois:

```powershell
npm install -g pnpm@10
```

**macOS** (com [Homebrew](https://brew.sh))

```bash
brew install node git
npm install -g pnpm@10
```

**Linux** (com [nvm](https://github.com/nvm-sh/nvm), funciona em qualquer distribuição)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
# feche e abra o terminal
nvm install 22
npm install -g pnpm@10
```

Confira: `node --version` precisa mostrar `v22.13` ou mais novo, e `pnpm --version`, `10.` alguma
coisa.

### 2. Claude Code

Instale pelo [site oficial](https://claude.com/claude-code) e, no terminal, rode `claude` uma vez
para entrar com a sua conta (plano Pro ou Max). Depois disso pode fechar: o Frank chama o Claude
Code sozinho quando precisa. Ele nunca lê nem guarda o seu login.

Confira: `claude --version` mostra a versão.

### 3. Baixar o Frank

```bash
git clone https://github.com/nskntc/frank.git
cd frank
pnpm install
```

### 4. Configurar os avisos

Copie o arquivo de exemplo:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env
# macOS e Linux
cp .env.example .env
```

Abra o `.env` num editor de texto (Bloco de Notas serve) e preencha o e-mail. Com Gmail:

```ini
SMTP_HOST=smtp.gmail.com
SMTP_PORTA=465
SMTP_USUARIO=seu.email@gmail.com
SMTP_SENHA=a senha de app de 16 letras
ALERTA_EMAIL_PARA=seu.email@gmail.com
```

A `SMTP_SENHA` **não é a senha do Gmail**: é uma "senha de app". Crie em
[myaccount.google.com](https://myaccount.google.com) → Segurança → Senhas de app (precisa da
verificação em duas etapas ligada).

Teste o aviso:

```bash
pnpm --filter @frank/vigia testar-aviso
```

Chegou um e-mail "Frank: teste de aviso"? Pronto. O Telegram e a SerpApi são opcionais; o passo a passo do
Telegram está no painel, em **Configurações → Avisos**.

O `.env` guarda senhas: ele fica só no seu computador e nunca vai para o Git.

### 5. Ligar

```bash
pnpm start
```

Na primeira vez demora uns minutos (ele monta tudo). Quando aparecer `Frank: vigia ligado`, abra
**<http://127.0.0.1:4321>** no navegador.

Em **Rotas**, escreva a viagem como você falaria ("Belo Horizonte para Salvador em julho, 10
dias, até R$ 900"), confira o que o Frank entendeu e salve. A partir daí ele vigia sozinho.

Para desligar, `Ctrl+C` no terminal. Para ligar de novo, `pnpm start` na pasta `frank`.

## Deixe o computador acordado

O Frank só vigia com o computador ligado e acordado. Se ele hibernar, a vigilância para (o painel
mostra "Vigia parado há X h") e volta sozinha quando o computador acorda. Passagem barata some em
horas, então vale deixar acordado enquanto vigia.

**Windows:** Configurações → Sistema → Energia → "Quando conectado, colocar o dispositivo em
suspensão após" → **Nunca**. A tela pode apagar à vontade, só a suspensão importa. Ou, no
PowerShell:

```powershell
powercfg /change standby-timeout-ac 0
```

**macOS:** ligue o Frank assim, e o Mac não dorme enquanto ele roda (a tela pode apagar):

```bash
caffeinate -i pnpm start
```

**Linux** (com systemd):

```bash
systemd-inhibit --what=idle:sleep --why="Frank vigiando passagens" pnpm start
```

Notebook: deixe na tomada, e com a tampa aberta (ou ajuste o que a tampa fechada faz nas opções de
energia).

## Antes de comprar

- **Confira o preço final no site antes de pagar.** O Frank mostra o que as fontes públicas
  informaram naquele momento; preço de passagem muda em minutos, e taxa de bagagem ou de cartão
  pode aparecer só no fim.
- O preço do aviso é **sem IOF**. Vendedor estrangeiro (ex.: Kiwi.com) cobra em outra moeda: o
  cartão soma IOF e câmbio.
- Prefira comprar na própria companhia quando a diferença for pequena: é onde valem as 24 h para
  desistir sem custo. O "Onde comprar" do aviso mostra isso.
- O Frank não é agência e não vende nada. Não é consultoria de viagem.

## O dia a dia

| Tela          | O que tem                                                                |
| ------------- | ------------------------------------------------------------------------ |
| Ofertas       | as ofertas achadas, com pegadinhas e onde comprar                        |
| Rotas         | as viagens vigiadas: criar, pausar, editar, ver o gráfico de preço       |
| Placar        | a corrida contra o alerta do Google Flights (veja abaixo)                |
| Configurações | se está tudo funcionando, horário silencioso e como configurar os avisos |

**Placar:** quer saber se o Frank é mais rápido que o alerta de preço do Google Flights? Ligue o
alerta do Google para a mesma viagem e, quando o e-mail dele chegar, registre a hora e o preço na
tela Placar. Os avisos do Frank entram sozinhos.

**Seus dados** ficam na pasta `data/` dentro de `frank` (histórico de preços, rotas, ofertas). Para
fazer cópia, copie essa pasta com o Frank desligado. Para começar do zero, apague-a.

## Atualizar

Com o Frank desligado, na pasta `frank`:

```bash
git pull
pnpm install
pnpm start
```

Suas rotas e o histórico continuam: o banco se atualiza sozinho.

## Problemas comuns

| O que aparece                                    | O que fazer                                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `Unsupported environment` ao instalar            | o Node é antigo: instale o 22.13 ou mais novo (passo 1)                                                       |
| `pnpm` ou `claude` não é reconhecido             | feche e abra o terminal; se continuar, refaça o passo 1 ou 2                                                  |
| "Claude indisponível" no painel                  | rode `claude` no terminal e entre de novo com a sua conta                                                     |
| "Vigia parado" no painel                         | o computador dormiu ou o terminal do `pnpm start` foi fechado: ligue de novo                                  |
| O e-mail de teste não chega                      | confira se a `SMTP_SENHA` é a senha de app (não a do Gmail) e olhe o spam                                     |
| `EADDRINUSE` / porta 4321 em uso                 | o Frank já está ligado em outro terminal; feche aquele ou use o que já está aberto                            |
| "chegou ao limite de consultas" em Configurações | rotas demais ou amplas demais para o dia: pause alguma ou aumente o intervalo; o limite volta sozinho em 24 h |

## Documentação

| Documento                                    | O que tem                                  |
| -------------------------------------------- | ------------------------------------------ |
| [Produto](docs/specs/SPEC-PRODUTO.md)        | visão, fluxo, telas e regras               |
| [MVP](docs/specs/SPEC-01-MVP.md)             | requisitos e critérios de aceite           |
| [Roadmap](docs/ROADMAP.md)                   | fases, do zero ao Frank completo           |
| [Stack](docs/decisoes/ADR-001-stack.md)      | tecnologia escolhida e por quê             |
| [Riscos](docs/RISCOS.md)                     | casos especiais que o Frank precisa tratar |
| [Técnicas de IA](docs/TECNICAS-DE-IA.md)     | o que o Frank usa de IA e onde             |
| [Diário de testes](docs/DIARIO-DE-TESTES.md) | cada experimento e o que ele ensinou       |
| [Diário de conteúdo](docs/CONTEUDO.md)       | os momentos da construção que viram post   |
| [Como contribuir](CONTRIBUTING.md)           | regras para quem mexe no código            |

## Aviso

O Frank mostra preços encontrados em fontes públicas. Confira sempre o preço final no site antes de
comprar. Não é consultoria de viagem.

## Licença

[MIT](LICENSE)
