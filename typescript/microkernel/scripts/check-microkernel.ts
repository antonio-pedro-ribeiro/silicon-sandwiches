// Fitness functions do microkernel:
//   1. O núcleo (src/core/) não importa nada dos plug-ins: só os conhece pelo contrato.
//   2. Um plug-in só importa ficheiros da sua pasta: não depende do núcleo nem de outros plug-ins.
//      Única exceção: `import type` do contrato (core/plugins/contracts.ts), que desaparece em tempo de execução.
//   3. Todos os plug-ins estão no registo e cumprem o contrato.
//   4. Dentro do núcleo, as regras do monólito modular: um módulo só usa outro pelo index.ts,
//      shared/ não depende de módulos e cada módulo só usa as suas tabelas.
// No fim, mostra a volatilidade do núcleo e dos plug-ins (commits no git): o núcleo deve mudar pouco.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const CORE = join(SRC, 'core');
const PLUGINS = join(SRC, 'plugins');
const MODULES = join(CORE, 'modules');

const filesIn = (dir: string, ext: string[]): string[] =>
  readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => ext.some((e) => f.endsWith(e))).map((f) => join(dir, f));
const specsIn = (code: string): string[] =>
  [...code.matchAll(/(?:from|import\s*\(?)\s*['"](\.[^'"]+)['"]/g)].map((m) => m[1]);
const importsOf = (file: string): string[] => specsIn(readFileSync(file, 'utf8'));
// `import type …` desaparece em tempo de execução: a regra 2 trata-o à parte.
const TYPE_IMPORT = /import\s+type\s[^'"]*?from\s*['"](\.[^'"]+)['"]/g;
const typeImportsOf = (file: string): string[] => [...readFileSync(file, 'utf8').matchAll(TYPE_IMPORT)].map((m) => m[1]);
const valueImportsOf = (file: string): string[] => specsIn(readFileSync(file, 'utf8').replace(TYPE_IMPORT, ''));
const inside = (file: string, dir: string): boolean => file.startsWith(dir + sep);
const where = (file: string): string => relative(SRC, file);

const violations: string[] = [];

// Regra 1
for (const file of filesIn(CORE, ['.ts'])) {
  for (const spec of importsOf(file)) {
    if (inside(resolve(dirname(file), spec), PLUGINS)) {
      violations.push(`${where(file)} importa ${spec}: o núcleo não pode depender de plug-ins`);
    }
  }
}

// Regra 2 (cada plug-in é a pasta plugins/<contrato>/<contexto>/)
const CONTRACT = join(CORE, 'plugins', 'contracts.ts');
const pluginDirs = readdirSync(PLUGINS, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((d) => readdirSync(join(PLUGINS, d.name)).map((ctx) => join(PLUGINS, d.name, ctx)));
for (const dir of pluginDirs) {
  for (const file of filesIn(dir, ['.ts'])) {
    for (const spec of valueImportsOf(file)) {
      if (!inside(resolve(dirname(file), spec), dir)) {
        violations.push(`${where(file)} importa ${spec}: um plug-in só pode usar a sua pasta`);
      }
    }
    for (const spec of typeImportsOf(file)) {
      const target = resolve(dirname(file), spec);
      if (target !== CONTRACT && !inside(target, dir)) {
        violations.push(`${where(file)} importa tipos de ${spec}: um plug-in só pode usar a sua pasta e o contrato`);
      }
    }
  }
}

// Regra 3
const registryFile = join(PLUGINS, 'registry.ts');
const registered = importsOf(registryFile).map((spec) => resolve(PLUGINS, spec));
for (const dir of pluginDirs) {
  if (!registered.includes(join(dir, 'index.ts'))) violations.push(`${where(dir)} não está em plugins/registry.ts`);
}
const { plugins } = await import(pathToFileURL(registryFile).href);
const { contractProblems } = await import(pathToFileURL(CONTRACT).href);
for (const plugin of plugins) violations.push(...contractProblems(plugin));

// Regra 4
const moduleOf = (file: string): string => {
  const parts = relative(CORE, file).split(sep);
  return parts[0] === 'modules' ? parts[1] : parts[0];
};
const modules = readdirSync(MODULES);
const tableOwner = new Map<string, string>();
for (const m of modules) {
  const schema = join(MODULES, m, 'persistence', 'schema.sql');
  if (!existsSync(schema)) continue;
  for (const [, table] of readFileSync(schema, 'utf8').matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)) {
    tableOwner.set(table, m);
  }
}
for (const m of modules) {
  for (const file of filesIn(join(MODULES, m), ['.ts', '.sql'])) {
    for (const spec of importsOf(file)) {
      const target = resolve(dirname(file), spec);
      const other = moduleOf(target);
      if (modules.includes(other) && other !== m && target !== join(MODULES, other, 'index.ts')) {
        violations.push(`${where(file)} importa ${spec}: só pode usar modules/${other}/index.ts`);
      }
    }
    for (const [, table] of readFileSync(file, 'utf8').matchAll(/\b(?:FROM|JOIN|INTO|UPDATE|REFERENCES)\s+(\w+)/gi)) {
      const owner = tableOwner.get(table);
      if (owner && owner !== m) violations.push(`${where(file)} usa a tabela ${table}, que pertence a ${owner}`);
    }
  }
}
for (const file of filesIn(join(CORE, 'shared'), ['.ts'])) {
  for (const spec of importsOf(file)) {
    if (modules.includes(moduleOf(resolve(dirname(file), spec)))) {
      violations.push(`${where(file)} importa ${spec}: shared/ não pode depender de módulos`);
    }
  }
}

if (violations.length) {
  console.error(`✘ ${violations.length} violação(ões) das regras do microkernel:`);
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log(
  `✔ Regras do microkernel respeitadas: o núcleo (${modules.length} módulos) não conhece os plug-ins; ` +
    `${plugins.length} plug-ins registados, independentes e conformes ao contrato.`,
);

// Volatilidade (informativa): quantos commits mexeram em cada parte.
try {
  const commits = (path: string): number =>
    execFileSync('git', ['log', '--format=%h', '--', path], { cwd: SRC, encoding: 'utf8' }).split('\n').filter(Boolean).length;
  console.log(`  Volatilidade (commits no git): núcleo ${commits('core')} · plug-ins ${commits('plugins')}`);
} catch {
  // Sem git: não há histórico para medir.
}
