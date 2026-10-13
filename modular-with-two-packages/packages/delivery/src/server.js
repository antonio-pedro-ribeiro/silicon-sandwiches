import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3004);
const dbPath = process.env.DB_PATH ?? fileURLToPath(new URL('../data/delivery.db', import.meta.url));

const app = createApp({ dbPath });
createServer(app.handler).listen(port, () => {
  console.log(`Silicon Sandwiches · Delivery (pacote 2 de 2) em http://localhost:${port}`);
  console.log(`Base de dados: ${dbPath}`);
});
