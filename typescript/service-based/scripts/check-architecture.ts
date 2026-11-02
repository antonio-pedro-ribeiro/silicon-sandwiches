// Fitness functions do service-based:
//   1. No máximo 12 serviços de domínio.
//   2. Um serviço (ou a interface) não importa código de outro serviço: só o seu e o de libs/.
//   3. Um serviço não chama outro serviço: a integração faz-se pela base de dados partilhada.
//   4. Só as bibliotecas de entidades têm SQL, e cada uma só usa as tabelas da sua partição.
//   5. Uma biblioteca só importa libs/platform (nunca serviços nem outras bibliotecas de entidades).
// No fim, a matriz de impacto: que serviços é preciso testar e reimplantar quando muda cada biblioteca.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SERVICES = join(ROOT, 'services');
const LIBS = join(ROOT, 'libs');
const MAX_SERVICES = 12;

const filesIn = (dir: string, ext: string[]): string[] =>
  readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => ext.some((e) => f.endsWith(e))).map((f) => join(dir, f));
const importsOf = (file: string): string[] =>
  [...readFileSync(file, 'utf8').matchAll(/(?:from|import\s*\(?)\s*['"](\.[^'"]+)['"]/g)].map((m) => m[1]);
const inside = (file: string, dir: string): boolean => file.startsWith(dir + sep);
const where = (file: string): string => relative(ROOT, file).split(sep).join('/');
const SQL = /\b(?:SELECT\s[\s\S]*?\sFROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i;

const services = readdirSync(SERVICES);
const libs = readdirSync(LIBS);
const deployables = [...services.map((s) => join(SERVICES, s)), join(ROOT, 'ui')];
const violations: string[] = [];

// Regra 1
if (services.length > MAX_SERVICES) violations.push(`${services.length} serviços de domínio: o máximo é ${MAX_SERVICES}`);

// Regras 2 e 3 (e a parte "só as bibliotecas têm SQL" da regra 4)
const libUsers = new Map(libs.map((l) => [l, new Set<string>()]));
for (const dir of deployables) {
  const name = where(dir);
  for (const file of filesIn(dir, ['.ts'])) {
    for (const spec of importsOf(file)) {
      const target = resolve(dirname(file), spec);
      if (inside(target, LIBS)) libUsers.get(relative(LIBS, target).split(sep)[0])!.add(name);
      else if (!inside(target, dir)) violations.push(`${where(file)} importa ${spec}: um serviço só usa o seu código e libs/`);
    }
    const code = readFileSync(file, 'utf8');
    if (inside(dir, SERVICES) && /\bfetch\s*\(/.test(code)) {
      violations.push(`${where(file)} faz pedidos HTTP: um serviço de domínio não chama outro`);
    }
    if (SQL.test(code)) violations.push(`${where(file)} tem SQL: o SQL fica nas bibliotecas de entidades`);
  }
}

// Regra 4: dono de cada tabela, lido de database/<partição>/schema.sql
const tableOwner = new Map<string, string>();
for (const partition of readdirSync(join(ROOT, 'database'), { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const schema = readFileSync(join(ROOT, 'database', partition.name, 'schema.sql'), 'utf8');
  for (const [, table] of schema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)) tableOwner.set(table, partition.name);
}
for (const lib of libs.filter((l) => l.endsWith('-entities'))) {
  const partition = lib.replace(/-entities$/, '');
  for (const file of filesIn(join(LIBS, lib), ['.ts'])) {
    for (const [, table] of readFileSync(file, 'utf8').matchAll(/\b(?:FROM|JOIN|INTO|UPDATE|REFERENCES)\s+(\w+)/gi)) {
      const owner = tableOwner.get(table);
      if (owner && owner !== partition) violations.push(`${where(file)} usa a tabela ${table}, da partição ${owner}`);
    }
  }
}

// Regra 5
for (const lib of libs) {
  for (const file of filesIn(join(LIBS, lib), ['.ts'])) {
    for (const spec of importsOf(file)) {
      const target = resolve(dirname(file), spec);
      if (!inside(target, join(LIBS, lib)) && !inside(target, join(LIBS, 'platform'))) {
        violations.push(`${where(file)} importa ${spec}: uma biblioteca só pode usar libs/platform`);
      }
    }
  }
}

if (violations.length) {
  console.error(`✘ ${violations.length} violação(ões) das regras do service-based:`);
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log(
  `✔ Regras do service-based respeitadas: ${services.length} serviços de domínio (máx. ${MAX_SERVICES}), ` +
    `sem chamadas entre si; ${tableOwner.size} tabelas em ${new Set(tableOwner.values()).size} partições lógicas.`,
);
console.log('\nSe mudar a biblioteca…            é preciso testar e reimplantar:');
for (const [lib, users] of libUsers) console.log(`  ${lib.padEnd(32)} ${[...users].join(', ') || '—'}`);
