// Teste de sistema: os dois pacotes de deployment a sério, cada um com a sua base de dados em memória,
// ligados por HTTP. São os mesmos testes das outras versões (layered, modular, big-ball-of-mud).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp as createDeliveryApp } from '../packages/delivery/src/app.js';
import { createApp } from '../packages/sandwiches/src/app.js';

process.env.SILENT = '1';

const portoOrder = (extra = {}) => ({
  storeId: 'porto-aliados',
  customerId: 'ana',
  items: [{ sandwichId: 'francesinha', quantity: 1 }, { sandwichId: 'tosta-mista', quantity: 2 }],
  ...extra,
});

// Arranca o sistema completo: primeiro o Delivery, depois o pacote sandwiches apontado para ele.
function startSystem() {
  const deliveryApp = createDeliveryApp();
  const deliveryServer = createServer(deliveryApp.handler).listen(0);
  const app = createApp({ deliveryUrl: `http://localhost:${deliveryServer.address().port}` });
  return {
    app,
    close: () => {
      app.close();
      deliveryServer.close();
      deliveryApp.close();
    },
  };
}

// Arranca o sistema e serve o pacote sandwiches num porto livre; devolve um cliente HTTP mínimo.
async function withServer(run) {
  const system = startSystem();
  const server = createServer(system.app.handler).listen(0);
  const base = `http://localhost:${server.address().port}`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };
  try {
    await run({ app: system.app, get: (p) => call('GET', p), post: (p, b) => call('POST', p, b) });
  } finally {
    server.close();
    system.close();
  }
}

const stockOf = async (get, storeId, ingredient) =>
  (await get(`/inventory/${storeId}`)).body.items.find((i) => i.ingredient === ingredient).quantity;

// --- Checkout -----------------------------------------------------------------------------

test('checkout no Porto aplica preço local, promoção e taxa de entrega', async () => {
  const { app, close } = startSystem();
  const order = await app.checkout.checkout(
    portoOrder({ promoCode: 'FCUL10', fulfilment: 'delivery', address: 'Rua de Santa Catarina, 100' }),
  );
  assert.equal(order.subtotalCents, 650 + 2 * 350);
  assert.equal(order.discountCents, 135);
  assert.equal(order.deliveryFeeCents, 250);
  assert.equal(order.totalCents, 1465);
  assert.equal(order.status, 'PLACED');
  assert.deepEqual(app.checkout.getOrder(order.id), order);
  close();
});

test('a francesinha não está no menu de Lisboa', async () => {
  const { app, close } = startSystem();
  await assert.rejects(
    app.checkout.checkout(portoOrder({ storeId: 'lisboa-campo-grande' })),
    { name: 'ValidationError' },
  );
  close();
});

test('pagamento recusado não grava a encomenda', async () => {
  const { app, close } = startSystem();
  await assert.rejects(
    app.checkout.checkout(portoOrder({ customerId: 'sem-saldo' })),
    { name: 'PaymentDeclinedError' },
  );
  assert.throws(() => app.checkout.getOrder(1), { name: 'NotFoundError' });
  close();
});

test('POST /checkout por HTTP devolve 201 e GET /orders/:id devolve a encomenda', async () => {
  await withServer(async ({ get, post }) => {
    const created = await post('/checkout', portoOrder());
    assert.equal(created.status, 201);
    const fetched = await get(`/orders/${created.body.id}`);
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.totalCents, 1350);
  });
});

// --- ManageInventory + Recipes ------------------------------------------------------------

test('o checkout gasta os ingredientes das receitas; um pagamento recusado devolve-os', async () => {
  await withServer(async ({ get, post }) => {
    assert.equal(await stockOf(get, 'porto-aliados', 'queijo'), 40);
    await post('/checkout', portoOrder());                                    // 1×3 + 2×2 fatias
    assert.equal(await stockOf(get, 'porto-aliados', 'queijo'), 33);
    const declined = await post('/checkout', portoOrder({ customerId: 'sem-saldo' }));
    assert.equal(declined.status, 402);
    assert.equal(await stockOf(get, 'porto-aliados', 'queijo'), 33);
  });
});

test('sem ingredientes suficientes a encomenda é recusada e nada é gasto', async () => {
  await withServer(async ({ get, post }) => {
    const res = await post('/checkout', portoOrder({ items: [{ sandwichId: 'francesinha', quantity: 11 }] }));
    assert.equal(res.status, 422);
    assert.match(res.body.error, /molho de francesinha/);
    assert.equal(await stockOf(get, 'porto-aliados', 'queijo'), 40);
  });
});

// --- Promotion ----------------------------------------------------------------------------

test('PORTO15 só vale no Porto e BEMVINDO só uma vez por cliente', async () => {
  await withServer(async ({ post }) => {
    const lisboa = { storeId: 'lisboa-campo-grande', customerId: 'rui', items: [{ sandwichId: 'bifana', quantity: 2 }] };
    assert.equal((await post('/checkout', { ...lisboa, promoCode: 'PORTO15' })).status, 422);
    assert.equal((await post('/checkout', { ...lisboa, promoCode: 'BEMVINDO' })).status, 201);
    assert.equal((await post('/checkout', { ...lisboa, promoCode: 'BEMVINDO' })).status, 422);
  });
});

// --- Location -----------------------------------------------------------------------------

test('fechar uma loja impede novas encomendas', async () => {
  await withServer(async ({ post }) => {
    assert.equal((await post('/stores/porto-aliados/status', { open: false })).body.open, false);
    assert.equal((await post('/checkout', portoOrder())).status, 422);
  });
});

// --- MakeOrder + Delivery -----------------------------------------------------------------

test('a encomenda gera um bilhete de cozinha e uma entrega, que avançam de estado', async () => {
  await withServer(async ({ get, post }) => {
    const order = (await post('/checkout', portoOrder({ fulfilment: 'delivery', address: 'Rua das Flores, 1' }))).body;

    const [ticket] = (await get('/kitchen/queue?storeId=porto-aliados')).body;
    assert.equal(ticket.orderId, order.id);
    assert.equal(ticket.status, 'QUEUED');
    assert.equal((await post(`/kitchen/tickets/${ticket.id}/advance`)).body.status, 'PREPARING');

    const [job] = (await get('/deliveries')).body;
    assert.equal(job.orderId, order.id);
    assert.equal(job.etaMinutes, 30);
    assert.equal((await post(`/deliveries/${job.id}/advance`)).body.status, 'OUT_FOR_DELIVERY');
    assert.equal((await post(`/deliveries/${job.id}/advance`)).body.status, 'DELIVERED');
    assert.equal((await post(`/deliveries/${job.id}/advance`)).status, 422);
  });
});
