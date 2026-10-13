// Fitness functions dos pacotes de deployment:
//   1. Cada pacote tem o seu package.json (é implantável sozinho).
//   2. Nenhum pacote importa código de outro pacote: só falam por HTTP.
// As regras de módulos dentro do pacote sandwiches estão em packages/sandwiches/scripts/check-modules.js.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGES = fileURLToPath(new URL('../packages/', import.meta.url));
const packages = readdirSync(PACKAGES);
const violations = [];

const importsOf = (file) =>
  [...readFileSync(file, 'utf8').matchAll(/(?:from|import\s*\(?)\s*['"](\.[^'"]+)['"]/g)].map((m) => m[1]);

for (const p of packages) {
  const root = join(PACKAGES, p);

  // Regra 1
  if (!existsSync(join(root, 'package.json'))) violations.push(`packages/${p} não tem package.json`);

  // Regra 2
  const files = readdirSync(root, { recursive: true })
    .filter((f) => f.endsWith('.js') && !f.split(sep).includes('node_modules'))
    .map((f) => join(root, f));
  for (const file of files) {
    for (const spec of importsOf(file)) {
      if (!resolve(dirname(file), spec).startsWith(root + sep)) {
        violations.push(`${relative(PACKAGES, file)} importa ${spec}: sai do pacote ${p}`);
      }
    }
  }
}

if (violations.length) {
  console.error(`✘ ${violations.length} violação(ões) das regras de deployment:`);
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log(`✔ ${packages.length} pacotes de deployment (${packages.join(', ')}): nenhum importa código de outro.`);
