// Fitness function para uma Big Ball of Mud: não há camadas nem módulos para verificar.
// Em vez de regras de dependência, mede quantas responsabilidades diferentes vivem no mesmo ficheiro
// e falha se houver mais do que uma. (Nas outras versões: check-layers.js e check-modules.js.)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

const CONCERNS = {
  'HTTP (pedidos e respostas)': /\bres\.writeHead\b|\breq\.method\b|createServer\(/g,
  'Router (rotas)': /p\.match\(\/\^|p == '\//g,
  'HTML': /<\/?(?:div|span|button|li|ul|table|section|header|form|input|label)\b/g,
  'CSS': /^\.[\w-]+[^{]*\{/gm,
  'JavaScript do browser (DOM)': /\bdocument\.|\bfetch\(/g,
  'Regras de negócio': /\bsubtotal\b|\bdiscount\b|'sem-saldo'|'COLLECTED'|'DELIVERED'/g,
  'SQL': /\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE TABLE)\b/g,
  'Dados de exemplo': /'tosta-mista'|'porto-aliados'/g,
  'Linha de comandos': /process\.argv|--demo|--reset/g,
};

let failed = false;
for (const name of readdirSync(SRC, { recursive: true }).filter((f) => f.endsWith('.js'))) {
  const text = readFileSync(join(SRC, name), 'utf8');
  const classes = text.match(/^(?:export\s+(?:default\s+)?)?class\s+\w+/gm) ?? [];
  const found = Object.entries(CONCERNS)
    .map(([concern, regex]) => [concern, (text.match(regex) ?? []).length])
    .filter(([, n]) => n > 0);

  console.log(`${name}: ${text.split('\n').length} linhas, ${classes.length} classe(s)`);
  for (const [concern, n] of found) console.log(`  · ${concern.padEnd(30)} ${n} ocorrência(s)`);
  if (found.length > 1) {
    failed = true;
    console.error(`✘ ${found.length} responsabilidades no mesmo ficheiro: não há fronteiras para verificar.`);
  }
}

if (failed) {
  console.error('  Uma mudança em qualquer uma delas obriga a abrir, perceber e testar o ficheiro inteiro.');
  process.exit(1);
}
console.log('✔ Uma responsabilidade por ficheiro.');
