import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3201);
const dbPath = process.env.DB_PATH ?? fileURLToPath(new URL('../../../data/checkout.db', import.meta.url));
// Onde estão os serviços de que este depende.
const services = {
  location: process.env.LOCATION_URL ?? 'http://localhost:3202',
  promotion: process.env.PROMOTION_URL ?? 'http://localhost:3203',
  delivery: process.env.DELIVERY_URL ?? 'http://localhost:3207',
  inventory: process.env.INVENTORY_URL ?? 'http://localhost:3204',
};
// Quem recebe o evento OrderPlaced (em produção, quem subscreve o tópico no broker).
const subscribers = {
  promotion: process.env.PROMOTION_URL ?? 'http://localhost:3203',
  kitchen: process.env.KITCHEN_URL ?? 'http://localhost:3206',
  delivery: process.env.DELIVERY_URL ?? 'http://localhost:3207',
};

const app = createApp({ dbPath, services, subscribers });
createServer(app.handler).listen(port, () => {
  console.log(`Microsserviço Checkout (CatalogCheckout) em http://localhost:${port}`);
  console.log(`Base de dados: ${dbPath}`);
});
