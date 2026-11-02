// Fitness functions dos microsserviços:
//   1. Um serviço não importa código de outro serviço: só o seu e o da plataforma (platform/).
//   2. A plataforma e o gateway não importam código de nenhum serviço.
//   3. Cada serviço tem a sua base de dados: só usa as tabelas do seu schema.sql.
//   4. O gateway não tem lógica de negócio: não tem SQL e não importa nada dos serviços.
// No fim, o mapa do acoplamento dinâmico: quem chama quem (lido dos createServiceClient de cada
// serviço) e quem recebe eventos.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SERVICES = join(ROOT, 'services');
const PLATFORM = join(ROOT, 'platform');
const GATEWAY = join(ROOT, 'gateway');

const filesIn = (dir: string, ext: string[]): string[] =>
  readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => ext.some((e) => f.endsWith(e))).map((f) => join(dir, f));
const importsOf = (file: string): string[] =>
  [...readFileSync(file, 'utf8').matchAll(/(?:from|import\s*\(?)\s*['"](\.[^'"]+)['"]/g)].map((m) => m[1]);
const inside = (file: string, dir: string): boolean => file.startsWith(dir + sep);
const where = (file: string): string => relative(ROOT, file).split(sep).join('/');

const services = readdirSync(SERVICES);
const violations: string[] = [];

// Dono de cada tabela, lido do schema.sql de cada serviço
const tableOwner = new Map<string, string>();
for (const s of services) {
  const schema = join(SERVICES, s, 'src', 'persistence', 'schema.sql');
  if (!existsSync(schema)) continue;
  for (const [, table] of readFileSync(schema, 'utf8').matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)) {
    tableOwner.set(table, s);
  }
}

const calls = new Map(services.map((s) => [s, new Set()]));
for (const s of services) {
  const dir = join(SERVICES, s);
  for (const file of filesIn(dir, ['.ts', '.sql'])) {
    // Regra 1
    for (const spec of importsOf(file)) {
      const target = resolve(dirname(file), spec);
      if (!inside(target, dir) && !inside(target, PLATFORM)) {
        violations.push(`${where(file)} importa ${spec}: um serviço só usa o seu código e platform/`);
      }
    }
    const code = readFileSync(file, 'utf8');
    // Regra 3
    for (const [, table] of code.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE|REFERENCES)\s+(\w+)/gi)) {
      const owner = tableOwner.get(table);
      if (owner && owner !== s) violations.push(`${where(file)} usa a tabela ${table}, da base de dados de ${owner}`);
    }
    for (const [, to] of code.matchAll(/(?:client\(|to: )'(\w+)'/g)) calls.get(s)!.add(to);
  }
}

// Regras 2 e 4
for (const dir of [PLATFORM, GATEWAY]) {
  for (const file of filesIn(dir, ['.ts'])) {
    for (const spec of importsOf(file)) {
      if (inside(resolve(dirname(file), spec), SERVICES)) {
        violations.push(`${where(file)} importa ${spec}: não pode depender de nenhum serviço`);
      }
    }
    if (dir === GATEWAY && /\b(?:SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/.test(readFileSync(file, 'utf8'))) {
      violations.push(`${where(file)} tem SQL: o gateway só encaminha pedidos`);
    }
  }
}

if (violations.length) {
  console.error(`✘ ${violations.length} violação(ões) das regras dos microsserviços:`);
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log(
  `✔ Regras dos microsserviços respeitadas: ${services.length} serviços, nenhum importa código de outro; ` +
    `${tableOwner.size} tabelas, cada uma na base de dados de um só serviço.`,
);

const subscribers = services.filter((s) =>
  filesIn(join(SERVICES, s), ['.ts']).some((f) => readFileSync(f, 'utf8').includes("router.post('/events/order-placed'")));
console.log('\nAcoplamento dinâmico (quem chama quem por HTTP):');
for (const [from, to] of calls) if (to.size) console.log(`  ${from.padEnd(10)} → ${[...to].join(', ')}`);
console.log(`  evento OrderPlaced (checkout) → ${subscribers.join(', ')}`);
