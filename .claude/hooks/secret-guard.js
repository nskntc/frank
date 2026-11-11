#!/usr/bin/env node
// PreToolUse (Bash|PowerShell): barra `git commit` quando o que vai entrar no commit
// carrega segredo. Invocado por secret-guard.sh (o harness prepende `bash ` ao command).
//
// Por que existe: segredo commitado fica no historico do git para sempre - tirar do repo
// depois nao desfaz o clone de quem ja baixou. O Frank e PUBLICO: qualquer token do
// Telegram ou chave do SerpApi commitado fica visivel para o mundo. A trava e a politica
// entre o modelo e a acao; uma regra no CLAUDE.md sozinha nao segura.
// (Importado do JN, que importou do aupus-service.)
//
// O que olha: o diff que vai ser commitado - o que ja esta no stage, mais o que um
// `git add` na mesma linha de comando vai colocar, mais o `-a` do commit.
//
// Falso positivo:
//   - linha com o marcador `segredo-ok` e ignorada (ex.: senha de fixture documentada)
//   - arquivo ja versionado de proposito (.env.production dos fronts): so o USUARIO
//     acrescenta o caminho em secret-guard-permitidos.txt. O Claude nunca edita essa lista.
//
// Sai com 0 quando nao ha o que barrar e com 2 (stderr volta para o Claude) quando ha.
// Erro interno sai com 0: a trava nunca impede o trabalho por defeito proprio.

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PERMITIDOS = path.join(__dirname, 'secret-guard-permitidos.txt');

const ARQUIVO_PROIBIDO = [
  { re: /(^|\/)\.env(\.[^/]+)?$/i, exceto: /\.(example|sample|template)$/i, motivo: 'arquivo .env' },
  { re: /\.(pem|key|p12|pfx|jks|keystore)$/i, motivo: 'chave/certificado' },
  { re: /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/i, motivo: 'chave SSH privada' },
  { re: /(^|\/)\.agent-browser-auth\.json$/i, motivo: 'estado de login do agent-browser' },
];

// Valem em qualquer arquivo, inclusive teste: nao existe fixture legitima disso.
const SEGREDO_FORTE = [
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, motivo: 'chave privada' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, motivo: 'chave AWS' },
  { re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/, motivo: 'token GitHub' },
  { re: /\bsk-(ant-)?[A-Za-z0-9_-]{24,}\b/, motivo: 'chave de API (sk-)' },
  { re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/, motivo: 'token Slack' },
  { re: /\bEAA[A-Za-z0-9]{40,}\b/, motivo: 'token da Meta (WhatsApp Cloud API)' },
  { re: /\$aact_(prod|hmlg)_[A-Za-z0-9_-]{16,}/, motivo: 'chave de API do Asaas' },
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/, motivo: 'chave Google (Gemini)' },
  { re: /\bgsk_[A-Za-z0-9]{40,}\b/, motivo: 'chave Groq' },
  { re: /\b\d{8,10}:AA[A-Za-z0-9_-]{33}\b/, motivo: 'token de bot do Telegram' },
];

// Fora de teste: atribuicao de senha/segredo com valor literal.
const ATRIBUICAO = [
  /\b(password|passwd|senha|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?key|jwt[_-]?secret)\b["']?\s*[:=]\s*["'`]([^"'`\s]{6,})["'`]/i,
  /^\s*(export\s+)?[A-Z0-9_]*(PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|SENHA)[A-Z0-9_]*\s*=\s*["']?([^\s"'#]{6,})/,
];
const URL_COM_SENHA = /\b(postgres(ql)?|mysql|mongodb(\+srv)?|redis|amqp|mqtts?):\/\/[^:\s/@]+:([^@\s/]{3,})@([^\s/:'"]+)/i;
const HOST_LOCAL = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|postgres|db|redis|mqtt|host\.docker\.internal)$/i;
const PLACEHOLDER = /^(\$\{|\$[A-Z_]|process\.env|env\(|config\(|<|\{\{|%|your|example|exemplo|changeme|change-me|xxx|\*{3}|placeholder|null|undefined|true|false)/i;

const ARQUIVO_TESTE = /(\.(spec|test|e2e|e2e-spec)\.[cm]?[jt]sx?$)|((^|\/)(tests?|__tests__|test-utils|fixtures?)\/)|(Test\.php$)/i;
const SEM_VARREDURA = /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|composer\.lock)$|\.min\.[jc]ss?$|(^|\/)dist\//i;

function lerStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

function caminhoNode(p) {
  // Git Bash entrega /c/Users/...; o node no Windows quer C:/Users/...
  const m = /^\/([a-zA-Z])(\/|$)(.*)$/.exec(p);
  return m ? `${m[1].toUpperCase()}:/${m[3]}` : p;
}

function semAspas(s) {
  const t = s.trim();
  return /^(['"]).*\1$/.test(t) ? t.slice(1, -1) : t;
}

function tokens(seg) {
  return (seg.match(/"[^"]*"|'[^']*'|\S+/g) || []).map(semAspas);
}

function git(dir, args) {
  return execFileSync('git', ['-C', dir, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

// Le a linha de comando em ordem: cd/Set-Location mudam o diretorio, `git add`
// acumula pathspecs, `git commit` dispara a checagem naquele repo.
function planejar(cmd, cwd) {
  const alvos = [];
  let dir = cwd;
  const pendentes = new Map(); // repo -> { tudo, paths[] }

  for (const bruto of cmd.split(/&&|\|\||;|\r?\n/)) {
    const seg = bruto.trim();
    const t = tokens(seg);
    if (!t.length) continue;

    if (/^(cd|Set-Location|sl|pushd)$/i.test(t[0]) && t[1]) {
      const destino = t[1] === '-Path' || t[1] === '-LiteralPath' ? t[2] : t[1];
      if (destino) dir = path.resolve(caminhoNode(dir), caminhoNode(destino));
      continue;
    }

    const iGit = t.findIndex((x) => /^git(\.exe)?$/i.test(x));
    if (iGit < 0) continue;

    let repo = dir;
    let i = iGit + 1;
    while (i < t.length && t[i].startsWith('-')) {
      if (t[i] === '-C' && t[i + 1]) {
        repo = path.resolve(caminhoNode(repo), caminhoNode(t[i + 1]));
        i += 2;
      } else if (t[i] === '-c' && t[i + 1]) {
        i += 2;
      } else {
        i += 1;
      }
    }
    const sub = t[i];
    const resto = t.slice(i + 1);
    const chave = path.resolve(caminhoNode(repo));

    if (sub === 'add') {
      const p = pendentes.get(chave) || { tudo: false, paths: [] };
      for (const a of resto) {
        if (a === '-A' || a === '--all' || a === '.' || a === '-u' || a === '--update') p.tudo = true;
        else if (!a.startsWith('-')) p.paths.push(a);
      }
      pendentes.set(chave, p);
    } else if (sub === 'commit') {
      const p = pendentes.get(chave) || { tudo: false, paths: [] };
      const flags = [];
      for (let k = 0; k < resto.length; k++) {
        const a = resto[k];
        if (a === '-m' || a === '-F' || a === '--message' || a === '--file') {
          k += 1; // pula o valor - a mensagem nao e flag
        } else if (/^-[a-zA-Z]+$/.test(a) || a.startsWith('--')) {
          flags.push(a);
        }
      }
      if (flags.some((f) => f === '--all' || (/^-[a-zA-Z]+$/.test(f) && f.includes('a')))) p.tudo = true;
      alvos.push({ repo: chave, ...p });
      pendentes.delete(chave);
    }
  }
  return alvos;
}

// Devolve [{ arquivo, linha, texto }] das linhas adicionadas, e a lista de arquivos tocados.
function coletar(alvo) {
  const linhas = [];
  const arquivos = new Set();

  const lerDiff = (args) => {
    let atual = null;
    let n = 0;
    for (const l of git(alvo.repo, args).split('\n')) {
      if (l.startsWith('+++ ')) {
        atual = l.startsWith('+++ b/') ? l.slice(6) : null;
        if (atual) arquivos.add(atual);
      } else if (l.startsWith('@@')) {
        const m = /\+(\d+)/.exec(l);
        n = m ? Number(m[1]) : 0;
      } else if (atual && l.startsWith('+')) {
        linhas.push({ arquivo: atual, linha: n, texto: l.slice(1) });
        n += 1;
      }
    }
  };

  const lerNovos = (paths) => {
    const lista = git(alvo.repo, ['ls-files', '--others', '--exclude-standard', '--', ...paths])
      .split('\n')
      .filter(Boolean);
    for (const arq of lista) {
      arquivos.add(arq);
      let conteudo = '';
      try {
        const abs = path.join(alvo.repo, arq);
        if (fs.statSync(abs).size > 2 * 1024 * 1024) continue;
        conteudo = fs.readFileSync(abs, 'utf8');
      } catch {
        continue;
      }
      conteudo.split('\n').forEach((texto, k) => linhas.push({ arquivo: arq, linha: k + 1, texto }));
    }
  };

  const base = ['diff', '--no-color', '--no-ext-diff', '-U0', '--diff-filter=ACMR'];
  lerDiff([...base, '--cached']);
  if (alvo.tudo) {
    lerDiff([...base, 'HEAD']);
    lerNovos([]);
  } else if (alvo.paths.length) {
    lerDiff([...base, 'HEAD', '--', ...alvo.paths]);
    lerNovos(alvo.paths);
  }
  return { linhas, arquivos: [...arquivos] };
}

function permitidos() {
  try {
    return fs
      .readFileSync(PERMITIDOS, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => l.replace(/\\/g, '/').toLowerCase());
  } catch {
    return [];
  }
}

function mascarar(v) {
  return v.length <= 4 ? '***' : `${v.slice(0, 2)}***`;
}

function avaliar(alvo, liberados) {
  const { linhas, arquivos } = coletar(alvo);
  return examinar(path.basename(alvo.repo), linhas, arquivos, liberados);
}

function examinar(nomeRepo, linhas, arquivos, liberados) {
  const achados = [];
  const relRepo = (arq) => `${nomeRepo}/${arq}`.toLowerCase();
  const liberado = (arq) => liberados.some((p) => relRepo(arq).endsWith(p) || arq.toLowerCase() === p);

  for (const arq of arquivos) {
    if (liberado(arq)) continue;
    for (const r of ARQUIVO_PROIBIDO) {
      if (r.re.test(arq) && !(r.exceto && r.exceto.test(arq))) achados.push(`${arq}: ${r.motivo} no commit`);
    }
  }

  for (const { arquivo, linha, texto } of linhas) {
    if (liberado(arquivo) || SEM_VARREDURA.test(arquivo) || /segredo-ok/.test(texto)) continue;
    const onde = `${arquivo}:${linha}`;

    const forte = SEGREDO_FORTE.find((r) => r.re.test(texto));
    if (forte) {
      achados.push(`${onde}: ${forte.motivo}`);
      continue;
    }
    if (ARQUIVO_TESTE.test(arquivo) || /\.(example|sample|template)$/i.test(arquivo) || /\.md$/i.test(arquivo)) continue;

    const url = URL_COM_SENHA.exec(texto);
    if (url && !HOST_LOCAL.test(url[5]) && !PLACEHOLDER.test(url[4])) {
      achados.push(`${onde}: URL com senha (${url[1]}://...:${mascarar(url[4])}@${url[5]})`);
      continue;
    }
    for (const re of ATRIBUICAO) {
      const m = re.exec(texto);
      if (!m) continue;
      const valor = m[m.length - 1];
      if (PLACEHOLDER.test(valor) || /process\.env|import\.meta\.env|getenv|env\(/i.test(texto)) continue;
      achados.push(`${onde}: valor literal em campo de segredo (${mascarar(valor)})`);
      break;
    }
  }
  return achados;
}

function main() {
  const entrada = lerStdin();
  const cmd = entrada && entrada.tool_input && entrada.tool_input.command;
  if (!cmd || !/\bgit\b[\s\S]*\bcommit\b/.test(cmd)) return 0;

  const cwd = entrada.cwd || process.cwd();
  const liberados = permitidos();
  const relatorio = [];

  for (const alvo of planejar(cmd, cwd)) {
    let achados;
    try {
      achados = avaliar(alvo, liberados);
    } catch {
      continue; // nao e repo git, ou git falhou: nao e papel desta trava
    }
    if (achados.length) relatorio.push(`  ${alvo.repo}`, ...achados.slice(0, 12).map((a) => `    - ${a}`));
  }

  if (!relatorio.length) return 0;

  process.stderr.write(
    [
      '[secret-guard] Commit barrado: o que vai entrar no commit parece conter segredo.',
      ...relatorio,
      '',
      'Segredo commitado fica no historico para sempre. Tire o segredo do diff (variavel de',
      'ambiente, .env fora do git, .env.example com valor vazio) e commite de novo.',
      'Falso positivo numa linha: acrescente o comentario `segredo-ok` nela e diga isso no resultado.',
      'Arquivo versionado de proposito: so o usuario o libera em .claude/hooks/secret-guard-permitidos.txt;',
      'nao edite essa lista - pare e pergunte.',
    ].join('\n') + '\n',
  );
  return 2;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch {
    process.exitCode = 0;
  }
} else {
  module.exports = { examinar, planejar }; // para calibrar contra o historico real
}
