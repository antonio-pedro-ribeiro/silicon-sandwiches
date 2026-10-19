import { createServer } from 'node:http';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3100);
// Onde está cada serviço. O Orders tem duas instâncias (é o que recebe mais pedidos dos clientes).
const urls = (value) => value.split(',').map((u) => u.trim());
const services = {
  orders: urls(process.env.ORDERS_URLS ?? 'http://localhost:3101,http://localhost:3111'),
  stores: urls(process.env.STORES_URL ?? 'http://localhost:3102'),
  kitchen: urls(process.env.KITCHEN_URL ?? 'http://localhost:3103'),
  delivery: urls(process.env.DELIVERY_URL ?? 'http://localhost:3104'),
};

const app = createApp({ services });
createServer(app.handler).listen(port, () => {
  console.log(`Silicon Sandwiches (Service-Based) · interface e API gateway em http://localhost:${port}`);
  for (const [name, list] of Object.entries(services)) console.log(`  ${name.padEnd(8)} → ${list.join(', ')}`);
});
