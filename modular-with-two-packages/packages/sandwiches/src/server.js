import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3003);
const dbPath = process.env.DB_PATH ?? fileURLToPath(new URL('../data/silicon-sandwiches.db', import.meta.url));
const deliveryUrl = process.env.DELIVERY_URL ?? 'http://localhost:3004';

const app = createApp({ dbPath, deliveryUrl });
createServer(app.handler).listen(port, () => {
  console.log(`Silicon Sandwiches (pacote 1 de 2) em http://localhost:${port}`);
  console.log(`Base de dados: ${dbPath}`);
  console.log(`Serviço Delivery: ${deliveryUrl}`);
});
