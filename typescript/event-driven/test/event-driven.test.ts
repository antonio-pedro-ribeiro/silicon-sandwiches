// Testes próprios da arquitetura Event-Driven com RabbitMQ:
// outbox transacional, publicação assíncrona, filas duráveis e idempotência dos consumidores.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startSystem } from '../scripts/system.ts';

process.env.SILENT = '1';

type Json = any;
type Call = (path: string, body?: unknown) => Promise<{ status: number; body: Json }>;
interface Client { get: Call; post: Call; [extra: string]: unknown }

const portoOrder = (extra: Record<string, unknown> = {}) => ({
  storeId: 'porto-aliados',
  customerId: 'ana',
  items: [{ sandwichId: 'francesinha', quantity: 1 }, { sandwichId: 'tosta-mista', quantity: 2 }],
  ...extra,
});

const client = (base: string) => async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: (await res.json()) as Json };
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('com a Kitchen desligada a encomenda é aceite; o bilhete aparece quando a Kitchen volta e consome a fila AMQP', async () => {
  const system = startSystem();
  await delay(50);
  const call = client(system.url);
  const restartKitchen = system.stop('kitchen');

  const order = await call('POST', '/checkout', portoOrder());
  assert.equal(order.status, 201);
  assert.equal((await call('GET', '/kitchen/queue')).status, 503);

  await restartKitchen();
  await system.app.events.dispatchPending();
  await delay(100);

  const res = await call('GET', '/kitchen/queue');
  assert.equal(res.status, 200);
  const tickets = res.body;
  assert.equal(tickets.length >= 1, true);
  assert.equal(tickets[0].orderId, order.body.id);
  await system.close();
});

test('consumidor idempotente: mensagem OrderPlaced entregue duas vezes cria um só bilhete', async () => {
  const system = startSystem();
  await delay(50);
  const call = client(system.url);
  const event = {
    id: 101,
    type: 'OrderPlaced',
    orderId: 42,
    storeId: 'porto-aliados',
    items: [{ name: 'Bifana', quantity: 1 }],
  };

  await system.rabbit.publish('silicon.events', 'orders.placed', event);
  await system.rabbit.publish('silicon.events', 'orders.placed', event);
  await delay(100);

  const res = await call('GET', '/kitchen/queue?storeId=porto-aliados');
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].orderId, 42);
  await system.close();
});

test('com o Location desligado não há checkouts (503), mas o menu continua a funcionar', async () => {
  const system = startSystem();
  await delay(50);
  const call = client(system.url);
  await system.stop('location');
  assert.equal((await call('POST', '/checkout', portoOrder())).status, 503);
  assert.equal((await call('GET', '/stores/porto-aliados/menu')).status, 200);
  await system.close();
});

test('o gateway só expõe as rotas públicas: rotas internas de eventos HTTP deixam de existir', async () => {
  const system = startSystem();
  await delay(50);
  const call = client(system.url);
  assert.equal((await call('GET', '/api/stores/porto-aliados')).status, 404);
  assert.equal((await call('POST', '/events/order-placed', {})).status, 404);
  assert.equal((await client(system.services.location)('GET', '/api/stores/porto-aliados')).status, 200);
  await system.close();
});
