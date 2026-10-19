// Testes próprios dos microsserviços: falhas parciais, eventos, idempotência e o gateway.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startSystem } from '../scripts/system.js';

process.env.SILENT = '1';

const portoOrder = (extra = {}) => ({
  storeId: 'porto-aliados',
  customerId: 'ana',
  items: [{ sandwichId: 'francesinha', quantity: 1 }, { sandwichId: 'tosta-mista', quantity: 2 }],
  ...extra,
});

const client = (base) => async (method, path, body) => {
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};

test('com a Kitchen desligada a encomenda é aceite; o bilhete aparece quando a Kitchen volta', async () => {
  const system = startSystem();
  const call = client(system.url);
  const restartKitchen = system.stop('kitchen');

  const order = await call('POST', '/checkout', portoOrder());
  assert.equal(order.status, 201);                          // não depende da Kitchen
  assert.equal((await call('GET', '/kitchen/queue')).status, 503);

  restartKitchen();
  await system.app.events.dispatchPending();                // o que o temporizador faria daqui a 2 s
  const [ticket] = (await call('GET', '/kitchen/queue')).body;
  assert.equal(ticket.orderId, order.body.id);
  system.close();
});

test('consumidor idempotente: o mesmo OrderPlaced entregue duas vezes cria um só bilhete', async () => {
  const system = startSystem();
  const kitchen = client(system.services.kitchen);
  const event = { type: 'OrderPlaced', orderId: 42, storeId: 'porto-aliados', items: [{ name: 'Bifana', quantity: 1 }] };
  await kitchen('POST', '/events/order-placed', event);
  await kitchen('POST', '/events/order-placed', event);
  assert.equal((await kitchen('GET', '/kitchen/queue')).body.length, 1);
  system.close();
});

test('com o Location desligado não há checkouts (503), mas o menu continua a funcionar', async () => {
  const system = startSystem();
  const call = client(system.url);
  system.stop('location');
  assert.equal((await call('POST', '/checkout', portoOrder())).status, 503);
  assert.equal((await call('GET', '/stores/porto-aliados/menu')).status, 200);
  system.close();
});

test('o gateway só expõe as rotas públicas: /api/… e /events/… ficam entre serviços', async () => {
  const system = startSystem();
  const call = client(system.url);
  assert.equal((await call('GET', '/api/stores/porto-aliados')).status, 404);
  assert.equal((await call('POST', '/events/order-placed', {})).status, 404);
  assert.equal((await client(system.services.location)('GET', '/api/stores/porto-aliados')).status, 200);
  system.close();
});
