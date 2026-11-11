// Claude falso para os testes: imita `claude --help` e `claude -p --output-format json`.
// O comportamento vem de FRANK_FALSO_MODO (o ambiente passa pela chamada isolada).
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const modo = process.env.FRANK_FALSO_MODO ?? 'eco';

if (args.includes('--help')) {
  const opcoes = [
    '--safe-mode', '--setting-sources', '--no-session-persistence', '--disable-slash-commands',
    '--strict-mcp-config', '--tools', '--output-format', '--json-schema', '--system-prompt',
  ].filter((o) => o !== process.env.FRANK_FALSO_SEM_OPCAO);
  process.stdout.write(opcoes.map((o) => `  ${o} <valor>   descricao`).join('\n'));
  process.exit(0);
}

let entrada = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => (entrada += d));
process.stdin.on('end', () => {
  const sistema = readFileSync(args[args.indexOf('--system-prompt-file') + 1], 'utf8');
  const sair = (obj, codigo = 0) => {
    process.stdout.write(JSON.stringify(obj));
    process.exit(codigo);
  };
  if (modo === 'eco') {
    sair({ type: 'result', subtype: 'success', is_error: false, result: '', structured_output: { mensagem: entrada, sistema, args } });
  } else if (modo === 'saida') {
    sair({ type: 'result', subtype: 'success', is_error: false, structured_output: JSON.parse(process.env.FRANK_FALSO_SAIDA) });
  } else if (modo === 'login') {
    sair({ type: 'result', subtype: 'success', is_error: true, result: 'Not logged in · Please run /login' }, 1);
  } else if (modo === 'limite') {
    sair({ type: 'result', subtype: 'success', is_error: true, result: 'Claude AI usage limit reached' }, 1);
  } else if (modo === 'lixo') {
    process.stdout.write('isto não é json');
    process.exit(0);
  } else if (modo === 'demora') {
    setTimeout(() => sair({ type: 'result', subtype: 'success', structured_output: {} }), 10_000);
  }
});
