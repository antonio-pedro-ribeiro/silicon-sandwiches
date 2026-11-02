// Prepara a base de dados partilhada e arranca os serviços, cada um no seu processo, com a saída prefixada:
// duas instâncias do Orders, uma de cada um dos outros serviços e a interface/gateway.
// É só uma comodidade para a aula: em produção cada serviço seria implantado e arrancado à parte.
// Ctrl+C para todos.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setupDatabase } from '../database/setup.ts';

const dbPath = fileURLToPath(new URL('../data/silicon-sandwiches.db', import.meta.url));
setupDatabase(dbPath);

const PROCESSES = [
  { name: 'orders #1', dir: '../services/orders/', port: 3101 },
  { name: 'orders #2', dir: '../services/orders/', port: 3111 },
  { name: 'stores   ', dir: '../services/stores/', port: 3102 },
  { name: 'kitchen  ', dir: '../services/kitchen/', port: 3103 },
  { name: 'delivery ', dir: '../services/delivery/', port: 3104 },
  { name: 'ui       ', dir: '../ui/', port: 3100 },
];

const children = PROCESSES.map(({ name, dir, port }) => {
  const child = spawn(process.execPath, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', 'src/server.ts'], {
    cwd: fileURLToPath(new URL(dir, import.meta.url)),
    env: { ...process.env, PORT: String(port), DB_PATH: dbPath },
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8');
    stream.on('data', (text) => {
      for (const line of text.trimEnd().split('\n')) console.log(`[${name}] ${line}`);
    });
  }
  child.on('exit', (code) => console.log(`[${name}] terminou (código ${code})`));
  return child;
});

process.on('SIGINT', () => {
  for (const child of children) child.kill();
  process.exit(0);
});
