# ADR-002 — Como o trabalho é organizado

Data: 2026-11-11 · Status: **aceita**

## Decisão

| Tema | Escolha |
|---|---|
| Tarefas | GitHub Issues do próprio repositório |
| Branches | tudo direto na `main` enquanto só o dono mexe no código |
| Qualidade | `pnpm verificar` verde antes de todo commit; CI roda o mesmo no GitHub Actions |
| Commits | mensagem com o número da issue quando houver (`#12: ...`) |

## Por que

- **GitHub Issues** fica junto do código e é público: quem acompanha o conteúdo vê o trabalho andando.
  O contrato de Jira do JN tem dados da conta pessoal e não cabe num repositório aberto.
- **Direto na `main`:** um desenvolvedor só, sem revisão de outra pessoa; branch e PR só somariam passos.

## Quando revisar

Quando entrar a primeira pessoa de fora contribuindo: passa a ser branch + PR, com o CI obrigatório.
