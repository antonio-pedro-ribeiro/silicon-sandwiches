import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../src/app.js';
import { startFakeDelivery } from './fakeDelivery.js';

process.env.SILENT = '1';

const portoOrder = (extra = {}) => ({
  storeId: 'porto-aliados',
  customerId: 'ana',
  items: [{ sandwichId: 'francesinha', quantity: 1 }, { sandwichId: 'tosta-mista', quantity: 2 }],
  ...extra,
});

// Um duplo do serviço Delivery (o outro pacote de deployment) para todos os testes.
const fakeDelivery = startFakeDelivery();
after(() => fakeDelivery.close());
const newApp = (options) => createApp({ deliveryUrl: fakeDelivery.url, ...options });

// Arranca a aplicação (BD em memória) num porto livre e devolve um cliente HTTP mínimo.
async function withServer(run, options) {
  const app = newApp(options);
  const server = createServer(app.handler).listen(0);
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
    await run({ app, get: (p) => call('GET', p), post: (p, b) => call('POST', p, b) });
  } finally {
    server.close();
    app.close();
  }
}

const stockOf = async (get, storeId, ingredient) =>
  (await get(`/inventory/${storeId}`)).body.items.find((i) => i.ingredient === ingredient).quantity;

// --- Checkout -----------------------------------------------------------------------------

test('checkout no Porto aplica preço local, promoção e taxa de entrega', async () => {
  const app = newApp();
  const order = await app.checkout.checkout(
    portoOrder({ promoCode: 'FCUL10', fulfilment: 'delivery', address: 'Rua de Santa Catarina, 100' }),
  );
  assert.equal(order.subtotalCents, 650 + 2 * 350);
  assert.equal(order.discountCents, 135);
  assert.equal(order.deliveryFeeCents, 250);
  assert.equal(order.totalCents, 1465);
  assert.equal(order.status, 'PLACED');
  assert.deepEqual(app.checkout.getOrder(order.id), order);
  app.close();
});

test('a francesinha não está no menu de Lisboa', async () => {
  const app = newApp();
  await assert.rejects(
    app.checkout.checkout(portoOrder({ storeId: 'lisboa-campo-grande' })),
    { name: 'ValidationError' },
  );
  app.close();
});

test('pagamento recusado não grava a encomenda', async () => {
  const app = newApp();
  await assert.rejects(
    app.checkout.checkout(portoOrder({ customerId: 'sem-saldo' })),
    { name: 'PaymentDeclinedError' },
  );
  assert.throws(() => app.checkout.getOrder(1), { name: 'NotFoundError' });
  app.close();
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

// --- Dois pacotes de deployment -----------------------------------------------------------

test('com o Delivery desligado, o levantamento na loja funciona e a entrega dá 503 sem gastar stock', async () => {
  await withServer(async ({ get, post }) => {
    assert.equal((await post('/checkout', portoOrder())).status, 201);
    const queijo = await stockOf(get, 'porto-aliados', 'queijo');

    const res = await post('/checkout', portoOrder({ fulfilment: 'delivery', address: 'Rua das Flores, 1' }));
    assert.equal(res.status, 503);
    assert.match(res.body.error, /Delivery não responde/);
    assert.equal(await stockOf(get, 'porto-aliados', 'queijo'), queijo);
    assert.equal((await get('/deliveries')).status, 503);
  }, { deliveryUrl: 'http://localhost:9' });
});
