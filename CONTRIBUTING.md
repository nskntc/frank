# Como contribuir

Obrigado pelo interesse no Frank. Antes de abrir um PR:

1. Leia o [`.claude/CLAUDE.md`](.claude/CLAUDE.md): as regras invioláveis valem para gente e para IA.
2. **Repositório público:** nenhum dado pessoal real (nome, e-mail, telefone, viagem real de alguém)
   em código, teste, doc, commit ou PR. Use dados fictícios.
3. **Nada de robô em site que proíbe.** Fonte nova só com termos de uso lidos e citados no PR.
4. **Preço nunca vem do modelo.** Toda mudança no fluxo do Claude mantém a saída validada por schema.
5. Rode `pnpm verificar` e diga no PR o que testou. Mudou tela: prints em 360, 768 e 1280 px.
6. Resultado de teste ao vivo vai como contagem e preço da rota de teste, sem dado de quem usa.

Segredos ficam no `.env`, que nunca entra no git. Chave nova entra vazia no `.env.example`.
