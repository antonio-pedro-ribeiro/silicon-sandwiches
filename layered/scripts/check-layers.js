// Fitness function: as camadas são fechadas.
// Cada camada só pode importar de si própria e da camada imediatamente abaixo.
// (Equivalente minimalista ao ArchUnit visto na aula.)
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const ALLOWED = {
  presentation: ['presentation', 'business'],
  business: ['business', 'persistence'],
  persistence: ['persistence'],
};

const layerOf = (file) => relative(SRC, file).split(sep)[0];
const importsOf = (file) =>
  [...readFileSync(file, 'utf8').matchAll(/(?:from|import\s*\()\s*['"](\.[^'"]+)['"]/g)].map((m) => m[1]);

const violations = [];
for (const layer of Object.keys(ALLOWED)) {
  const dir = join(SRC, layer);
  for (const name of readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.js'))) {
    const file = join(dir, name);
    for (const spec of importsOf(file)) {
      const target = layerOf(resolve(dirname(file), spec));
      if (!ALLOWED[layer].includes(target)) {
        violations.push(`${relative(SRC, file)} importa ${spec}: ${layer} não pode depender de ${target}`);
      }
    }
  }
}

if (violations.length) {
  console.error(`✘ ${violations.length} violação(ões) das regras de camadas:`);
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log('✔ Regras de camadas respeitadas (presentation → business → persistence).');
