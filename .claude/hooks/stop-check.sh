#!/usr/bin/env bash
# Stop hook: impede fechar o trabalho com pendencia obvia no repo do Frank.
# Recebe JSON do harness via stdin. Adaptado do stop-check do JN (que veio do aupus-service).
#
# Bloqueia quando:
#   - ha mudanca nao commitada ou commit local nao pushado
#   - algum package.json mudou sem o pnpm-lock.yaml no mesmo conjunto
#     (o CI e o deploy rodam --frozen-lockfile e quebram nesse caso)
#
# Nunca bloqueia duas vezes seguidas (stop_hook_active): sem essa trava, uma parada
# legitima no meio da tarefa, para perguntar algo, viraria loop.

set -uo pipefail

input=$(cat)

active=$(node -e "
let c=[];process.stdin.on('data',d=>c.push(d));process.stdin.on('end',()=>{
  try{const i=JSON.parse(Buffer.concat(c).toString());process.stdout.write(i.stop_hook_active?'1':'0');}
  catch(e){process.stdout.write('0');}
});" <<< "$input")

[ "$active" = "1" ] && exit 0

d="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
[ -d "$d/.git" ] || exit 0

pend=""

sujos=$(git -C "$d" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
naopush=$(git -C "$d" rev-list --count @{u}..HEAD 2>/dev/null || echo 0)
[ -z "$naopush" ] && naopush=0

[ "$sujos" != "0" ] && pend="$pend
  - $sujos arquivo(s) nao commitado(s)"
[ "$naopush" != "0" ] && pend="$pend
  - $naopush commit(s) nao pushado(s)"

mudados=$(
  git -C "$d" status --porcelain 2>/dev/null | awk '{print $NF}'
  [ "$naopush" != "0" ] && git -C "$d" diff --name-only @{u}..HEAD 2>/dev/null
)
if echo "$mudados" | grep -q 'package\.json$' && ! echo "$mudados" | grep -q 'pnpm-lock\.yaml$'; then
  pend="$pend
  - package.json mudou sem o pnpm-lock.yaml junto (CI e deploy usam --frozen-lockfile)"
fi

[ -z "$pend" ] && exit 0

reason="[stop-check] Pendencias no repo do Frank:
$pend

Se forem deste trabalho, termine antes de fechar (commit + push; lockfile junto do package.json).
Se forem de outra sessao ou pre-existentes, diga isso ao usuario e pare -- este aviso nao repete."

node -e "process.stdout.write(JSON.stringify({decision:'block',reason:process.argv[1]}));" "$reason"
