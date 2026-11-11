---
name: verificacao
description: Verificacao obrigatoria antes de declarar qualquer task do Frank pronta - lint, typecheck, testes, build, seguranca do diff, revisao por agentes especializados, eval das skills quando prompt ou skill muda, verificacao visual do painel quando mexe em tela, e leitura do proprio diff - com relatorio PASS/FAIL e a saida real de cada etapa. Invoque automaticamente quando for dizer "pronto", "terminei", "pode revisar", antes de commitar o fim de uma task, ou quando o usuario pedir "verifica", "roda a verificacao", "ta tudo verde?".
---

# verificacao — o que "pronto" quer dizer no Frank

Importada do JN. **"Pronto" e o relatorio abaixo com a saida real, nunca "deve funcionar".**

Fase que falha por algo da task: corrige e roda de novo. Fase que falha por algo pre-existente ou
fora do escopo: registra e segue, dizendo isso.

## Fase 1 — lint, tipos, testes, build

```bash
pnpm verificar        # = turbo run lint typecheck test build
```

Durante o trabalho, um pacote so: `pnpm --filter @frank/dominio test`. No fim, sempre o inteiro.
*(Antes do esqueleto da Fase 0 existir, esta fase e n/a.)*

## Fase 2 — seguranca do diff

1. **Segredo:** o hook `secret-guard` barra commit com segredo. Nao contornar: tirar do diff.
   Falso positivo numa linha leva `segredo-ok` e e citado no relatorio.
2. **Dependencia:** `package.json` mudou -> `pnpm audit --prod`, reportar high/critical **novo**.
   Lockfile no mesmo commit.
3. **Dado pessoal:** repo publico. Nada de nome, e-mail, telefone ou viagem real em codigo,
   fixture, doc ou print.

## Fase 3 — revisao por agentes especializados

Escolher pelo que o diff toca e rodar **em paralelo** (sao so leitura):

| O diff toca | Agente |
|---|---|
| tratamento de erro, chamada externa, ciclo do vigia, detector, alerta, formulario | `falha-silenciosa` |
| prompt, skill, chamada ao Claude, adaptador de fonte, rota da API local, tela com dado de fora, config, dependencia | `revisor-de-seguranca` |
| schema, migracao, historico, `packages/dominio` (preco, detector, datas), conversao de resposta de fonte | `revisor-de-dados` |
| so CSS/texto/layout | nenhum |

Achado real no escopo -> corrige e volta a fase 1; fora do escopo -> registra; falso positivo ->
descarta dizendo por que.

## Fase 4 — eval das skills (quando prompt, skill ou parser do Claude mudou)

Roteiros com entradas conhecidas (pedidos em texto livre, ofertas com pegadinha conhecida) contra
o Claude. Confere-se o JSON (campos, pegadinhas apontadas), nao o texto. *(O comando nasce na
Fase 1; ate la, n/a.)*

## Fase 5 — tela: verificacao visual

Toda task que mexe no painel, com o servidor de dev de pe:

| Largura | O que conferir |
|---|---|
| 360 px | sem rolagem lateral, botao de compra visivel |
| 768 px | cards e grafico sem quebrar |
| 1280 px | largura maxima, linhas legiveis |

- Tema claro e escuro
- Console sem erro
- Sem rolagem horizontal: `document.documentElement.scrollWidth === window.innerWidth`
- Prints das tres larguras no relatorio (com dados ficticios)

## Fase 6 — ler o proprio diff

`git diff` (e `--cached`) inteiro, com olho de revisor:
- so mudou o que a task pedia?
- sobrou `console.log`, `debugger`, codigo comentado, TODO sem dono?
- `any` novo; preco fora de centavos; data como `Date` solta
- doc, skill ou diario desatualizado pelo que mudou? Atualizar junto

## Relatorio

```
VERIFICACAO — Frank — PASS | FAIL
lint .......... PASS
typecheck ..... PASS
testes ........ PASS  42/42  (novos: 3)
build ......... PASS
seguranca ..... PASS  (secret-guard ok; sem dependencia nova)
revisao ....... 1 achado: corrigido
eval skills ... n/a
tela .......... PASS  (360/768/1280, claro e escuro, 0 erros)
diff .......... PASS
pendencias: ...
```

FAIL em qualquer linha -> o relatorio diz qual e por que. Entregar com algo vermelho e legitimo;
esconder que esta vermelho nao e.
