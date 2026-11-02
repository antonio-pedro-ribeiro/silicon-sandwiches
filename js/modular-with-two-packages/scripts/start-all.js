// Arranca os dois pacotes de deployment, cada um no seu processo, com a saída de cada um prefixada.
// É só uma comodidade para a aula: em produção cada pacote seria implantado e arrancado à parte.
// Ctrl+C para os dois.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PACKAGES = [
  { name: 'delivery  ', dir: '../packages/delivery/' },
  { name: 'sandwiches', dir: '../packages/sandwiches/' },
];

// PORT e DB_PATH valem para um só processo: aqui cada pacote usa os seus valores por omissão.
const { PORT, DB_PATH, ...env } = process.env;

const children = PACKAGES.map(({ name, dir }) => {
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/server.js'], {
    cwd: fileURLToPath(new URL(dir, import.meta.url)),
    env,
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
