// Arranca os sete microsserviços e o gateway, cada um no seu processo, com a saída de cada um prefixada.
// Cada serviço usa a sua base de dados (data/<serviço>.db) e encontra os outros pelos portos de topology.json.
// É só uma comodidade para a aula: em produção cada serviço seria implantado e arrancado à parte
// (por exemplo, num contentor, com o Kubernetes a tratar do arranque e da descoberta de serviços).
// Ctrl+C para todos.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const topology = JSON.parse(readFileSync(new URL('./topology.json', import.meta.url), 'utf8'));
// PORT e DB_PATH valem para um só processo: aqui cada serviço usa os seus valores por omissão.
const { PORT, DB_PATH, ...env } = process.env;

const children = Object.keys(topology).map((name) => {
  const dir = name === 'gateway' ? '../gateway/' : `../services/${name}/`;
  const child = spawn(process.execPath, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', 'src/server.ts'], {
    cwd: fileURLToPath(new URL(dir, import.meta.url)),
    env,
  });
  const prefix = name.padEnd(9);
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8');
    stream.on('data', (text) => {
      for (const line of text.trimEnd().split('\n')) console.log(`[${prefix}] ${line}`);
    });
  }
  child.on('exit', (code) => console.log(`[${prefix}] terminou (código ${code})`));
  return child;
});

process.on('SIGINT', () => {
  for (const child of children) child.kill();
  process.exit(0);
});
