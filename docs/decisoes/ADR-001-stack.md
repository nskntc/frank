# ADR-001 — Stack

Data: 2026-11-11 · Status: **aceita** (confirmada pelo dono do projeto em 2026-11-11)

## Decisão

| Tema | Escolha |
|---|---|
| Repositório | monorepo pnpm + Turborepo, **público**, licença MIT |
| Painel | Next.js 16 (App Router), React 19, Tailwind 4, ícones Lucide; servido só em `127.0.0.1` |
| API local | rotas do próprio Next (`app/api`), sem servidor separado |
| Vigia | processo Node em TypeScript (`apps/vigia`) com o ciclo |
| Banco | SQLite local num arquivo (`data/frank.db`); biblioteca escolhida no card do esqueleto |
| Domínio | `packages/dominio`, funções puras usadas pelo painel e pelo vigia |
| Contratos | Zod, inclusive para validar a saída JSON do Claude |
| IA | `claude -p --output-format json` atrás de `ProvedorLLM` |
| Fontes | interface `FontePreco`; `KiwiMcp` primeiro |
| Alertas | interface `CanalAlerta`; Telegram primeiro |
| Testes | Vitest |
| Linguagem | TypeScript ~6.0 (estrito) |
| Lint | ESLint 9 + typescript-eslint |

## Por que

- **Mesma família do JN e do aupus-service:** hooks, agentes revisores, skill de verificação e as
  armadilhas já conhecidas vêm prontos.
- **Painel moderno é o ponto forte:** Next.js + Tailwind entrega o visual minimalista que o
  produto pede, com tema claro e escuro.
- **Uma linguagem só** para painel, vigia, domínio e testes.
- **Instalação simples para quem baixa do GitHub:** só Node e pnpm. Sem Docker, Postgres ou Redis:
  um arquivo SQLite basta para uma pessoa só.
- **Interfaces nas integrações:** trocar Kiwi, Claude ou Telegram vira configuração, não reescrita.

## Alternativa considerada

Python como o Harvey (FastAPI + HTML/CSS/JS servidos do disco). Mais simples de instalar para quem
já tem Python e é o padrão do Harvey, mas o painel moderno sai mais trabalhoso e a metodologia do
JN teria de ser refeita.

## Versões travadas

| Pacote | Versão | Motivo (herdado do JN) |
|---|---|---|
| TypeScript | ~6.0 | `typescript-eslint` 8 aceita até `<6.1` |
| ESLint | ^9 | plugins do `eslint-config-next` 16 ainda não aceitam o 10 |

## Consequências

- `pnpm dev` sobe painel e vigia juntos; `pnpm start` para uso diário depois do build.
- Biblioteca de SQLite com módulo nativo entra em `onlyBuiltDependencies` do `pnpm-workspace.yaml`.
- O computador precisa ficar ligado para o vigia rodar; o README explica como evitar a hibernação.
