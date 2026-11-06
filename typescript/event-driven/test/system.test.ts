// Teste de sistema: os sete microsserviços a sério, cada um com a sua base de dados em memória,
// atrás do API gateway, integrados pelo broker RabbitMQ (com in-memory broker fallback nos testes).
// São os mesmos testes das outras versões (layered, modular, big-ball-of-mud…).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startSystem } from '../scripts/system.ts';

process.env.SILENT = '1';

// As respostas da API são JSON sem tipo: os testes leem só os campos de que precisam.
type Json = any;
type Call = (path: string, body?: unknown) => Promise<{ status: number; body: Json }>;
interface Client { get: Call; post: Call; [extra: string]: unknown }

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const portoOrder = (extra: Record<string, unknown> = {}) => ({
  storeId: 'porto-aliados',
  customerId: 'ana',
  items: [{ sandwichId: 'francesinha', quantity: 1 }, { sandwichId: 'tosta-mista', quantity: 2 }],
  ...extra,
});

// Arranca o sistema e devolve um cliente HTTP mínimo, que fala com o gateway.
async function withServer(run: (client: Client) => Promise<void>): Promise<void> {
  const system = startSystem();
  await delay(20);
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(system.url + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    // Dá uma fração de tempo para consumidores de eventos AMQP processarem se for POST /checkout
    if (path === '/checkout' && method === 'POST') {
      await delay(25);
    }
    return { status: res.status, body: (await res.json()) as Json };
  };
  try {
    await run({ app: system.app, get: (p) => call('GET', p), post: (p, b) => call('POST', p, b) });
  } finally {
    await system.close();
  }
}

const stockOf = async (get: Call, storeId: string, ingredient: string): Promise<number> =>
  (await get(`/inventory/${storeId}`)).body.items.find((i: Json) => i.ingredient === ingredient).quantity;

// --- Checkout -----------------------------------------------------------------------------

test('checkout no Porto aplica preço local, promoção e taxa de entrega', async () => {
  await withServer(async ({ app }) => {
    const order = await (app as any).checkout.checkout(
      portoOrder({ promoCode: 'FCUL10', fulfilment: 'delivery', address: 'Rua de Santa Catarina, 100' }),
    );
    assert.equal(order.subtotalCents, 650 + 2 * 350);
    assert.equal(order.discountCents, 135);
    assert.equal(order.deliveryFeeCents, 250);
    assert.equal(order.totalCents, 1350 - 135 + 250);
    assert.equal(order.lines.length, 2);
    assert.equal(order.lines[0].unitPriceCents, 650);
    assert.equal(order.lines[1].unitPriceCents, 350);
  });
});

test('a francesinha não está no menu de Lisboa', async () => {
  await withServer(async ({ app }) => {
    await assert.rejects(
      () => (app as any).checkout.checkout({ storeId: 'lisboa-campo-grande', customerId: 'ana', items: [{ sandwichId: 'francesinha', quantity: 1 }] }),
      /não está no menu/,
    );
  });
});

test('pagamento recusado não grava a encomenda', async () => {
  await withServer(async ({ app }) => {
    await assert.rejects(
      () => (app as any).checkout.checkout({ storeId: 'porto-aliados', customerId: 'sem-saldo', items: [{ sandwichId: 'prego', quantity: 1 }] }),
      { name: 'PaymentDeclinedError' },
    );
    assert.throws(() => (app as any).checkout.getOrder(1), { name: 'NotFoundError' });
  });
});

test('POST /checkout por HTTP devolve 201 e GET /orders/:id devolve a encomenda', async () => {
  await withServer(async ({ get, post }) => {
    const res = await post('/checkout', portoOrder());
    assert.equal(res.status, 201);
    assert.equal(res.body.storeId, 'porto-aliados');

    const order = await get(`/orders/${res.body.id}`);
    assert.equal(order.status, 200);
    assert.equal(order.body.id, res.body.id);
  });
});

test('o checkout gasta os ingredientes das receitas; um pagamento recusado devolve-os', async () => {
  await withServer(async ({ get, post }) => {
    const stockAntes = await stockOf(get, 'porto-aliados', 'bife');
    await post('/checkout', portoOrder());
    assert.equal(await stockOf(get, 'porto-aliados', 'bife'), stockAntes - 1);

    await post('/checkout', portoOrder({ customerId: 'sem-saldo' }));
    assert.equal(await stockOf(get, 'porto-aliados', 'bife'), stockAntes - 1);
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
