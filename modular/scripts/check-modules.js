// Fitness functions do monólito modular:
//   1. Um módulo só usa outro módulo através do seu index.js (API pública).
//   2. O código partilhado (shared/) não depende de nenhum módulo.
//   3. Um módulo só lê e escreve as suas próprias tabelas.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const MODULES = join(SRC, 'modules');

const filesIn = (dir, ext) =>
  readdirSync(dir, { recursive: true }).filter((f) => ext.some((e) => f.endsWith(e))).map((f) => join(dir, f));
const importsOf = (file) =>
  [...readFileSync(file, 'utf8').matchAll(/(?:from|import\s*\()\s*['"](\.[^'"]+)['"]/g)].map((m) => m[1]);
const moduleOf = (file) => {
  const parts = relative(SRC, file).split(sep);
  return parts[0] === 'modules' ? parts[1] : parts[0];
};

const modules = readdirSync(MODULES);
const violations = [];

// Dono de cada tabela, lido dos schema.sql de cada módulo
const tableOwner = new Map();
for (const m of modules) {
  const schema = join(MODULES, m, 'persistence', 'schema.sql');
  if (!existsSync(schema)) continue;
  for (const [, table] of readFileSync(schema, 'utf8').matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)) {
    tableOwner.set(table, m);
  }
}

for (const m of modules) {
  for (const file of filesIn(join(MODULES, m), ['.js', '.sql'])) {
    const where = relative(SRC, file);

    // Regra 1
    for (const spec of importsOf(file)) {
      const target = resolve(dirname(file), spec);
      const other = moduleOf(target);
      if (modules.includes(other) && other !== m && target !== join(MODULES, other, 'index.js')) {
        violations.push(`${where} importa ${spec}: só pode usar modules/${other}/index.js`);
      }
    }

    // Regra 3
    const sql = readFileSync(file, 'utf8');
    for (const [, table] of sql.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE|REFERENCES)\s+(\w+)/gi)) {
      const owner = tableOwner.get(table);
      if (owner && owner !== m) violations.push(`${where} usa a tabela ${table}, que pertence a ${owner}`);
    }
  }
}

// Regra 2
for (const file of filesIn(join(SRC, 'shared'), ['.js'])) {
  for (const spec of importsOf(file)) {
    if (modules.includes(moduleOf(resolve(dirname(file), spec)))) {
      violations.push(`${relative(SRC, file)} importa ${spec}: shared/ não pode depender de módulos`);
    }
  }
}

if (violations.length) {
  console.error(`✘ ${violations.length} violação(ões) das regras de módulos:`);
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log(`✔ Regras de módulos respeitadas (${modules.length} módulos, ${tableOwner.size} tabelas com dono).`);
