import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3204);
const dbPath = process.env.DB_PATH ?? fileURLToPath(new URL('../../../data/inventory.db', import.meta.url));
// Onde estão os serviços de que este depende.
const services = {
  recipes: process.env.RECIPES_URL ?? 'http://localhost:3205',
};

const app = createApp({ dbPath, services });
createServer(app.handler).listen(port, () => {
  console.log(`Microsserviço Inventory (ManageInventory) em http://localhost:${port}`);
  console.log(`Base de dados: ${dbPath}`);
});
