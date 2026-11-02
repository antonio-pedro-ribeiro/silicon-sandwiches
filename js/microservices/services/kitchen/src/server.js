import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3206);
const dbPath = process.env.DB_PATH ?? fileURLToPath(new URL('../../../data/kitchen.db', import.meta.url));

const app = createApp({ dbPath });
createServer(app.handler).listen(port, () => {
  console.log(`Microsserviço Kitchen (MakeOrder) em http://localhost:${port}`);
  console.log(`Base de dados: ${dbPath}`);
});
