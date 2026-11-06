import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';

const port = Number(process.env.PORT ?? 3301);
const dbPath = process.env.DB_PATH ?? fileURLToPath(new URL('../../../data/checkout.db', import.meta.url));
// Onde estão os serviços de que este depende.
const services = {
  location: process.env.LOCATION_URL ?? 'http://localhost:3302',
  promotion: process.env.PROMOTION_URL ?? 'http://localhost:3303',
  delivery: process.env.DELIVERY_URL ?? 'http://localhost:3307',
  inventory: process.env.INVENTORY_URL ?? 'http://localhost:3304',
};

const app = createApp({ dbPath, services });
createServer(app.handler).listen(port, () => {
  console.log(`Microsserviço Checkout (CatalogCheckout) em http://localhost:${port}`);
  console.log(`Base de dados: ${dbPath}`);
});
