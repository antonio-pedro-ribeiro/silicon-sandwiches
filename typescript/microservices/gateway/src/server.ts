import { createServer } from 'node:http';
import { createApp } from './app.ts';

const port = Number(process.env.PORT ?? 3200);
// Onde está cada serviço (uma lista de URLs, separados por vírgulas, se houver várias instâncias).
const urls = (value: string): string[] => value.split(',').map((u) => u.trim());
const services = {
  checkout: urls(process.env.CHECKOUT_URL ?? 'http://localhost:3201'),
  location: urls(process.env.LOCATION_URL ?? 'http://localhost:3202'),
  promotion: urls(process.env.PROMOTION_URL ?? 'http://localhost:3203'),
  inventory: urls(process.env.INVENTORY_URL ?? 'http://localhost:3204'),
  recipes: urls(process.env.RECIPES_URL ?? 'http://localhost:3205'),
  kitchen: urls(process.env.KITCHEN_URL ?? 'http://localhost:3206'),
  delivery: urls(process.env.DELIVERY_URL ?? 'http://localhost:3207'),
};

const app = createApp({ services });
createServer(app.handler).listen(port, () => {
  console.log(`Silicon Sandwiches (Microservices) · API gateway e interface em http://localhost:${port}`);
  for (const [name, list] of Object.entries(services)) console.log(`  ${name.padEnd(9)} → ${list.join(', ')}`);
});
