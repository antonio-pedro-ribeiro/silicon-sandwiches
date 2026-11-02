import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';

const port = Number(process.env.PORT ?? 3202);
const dbPath = process.env.DB_PATH ?? fileURLToPath(new URL('../../../data/location.db', import.meta.url));

const app = createApp({ dbPath });
createServer(app.handler).listen(port, () => {
  console.log(`Microsserviço Location em http://localhost:${port}`);
  console.log(`Base de dados: ${dbPath}`);
});
