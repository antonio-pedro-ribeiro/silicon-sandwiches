import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';

const port = Number(process.env.PORT ?? 3103);
const dbPath = process.env.DB_PATH ?? fileURLToPath(new URL('../../../data/silicon-sandwiches.db', import.meta.url));
if (!existsSync(dbPath)) {
  console.error(`Não existe a base de dados partilhada em ${dbPath}. Na pasta service-based: npm run setup:db`);
  process.exit(1);
}

const app = createApp({ dbPath });
createServer(app.handler).listen(port, () => {
  console.log(`Serviço Kitchen (MakeOrder) em http://localhost:${port}`);
  console.log(`Base de dados partilhada: ${dbPath}`);
});
