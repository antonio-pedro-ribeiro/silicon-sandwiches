// Testes próprios do service-based: o que muda por haver uma base de dados partilhada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
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

// Conta linhas diretamente na base de dados partilhada, como faria qualquer serviço.
const count = (dbPath, table) => {
  const db = new DatabaseSync(dbPath);
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get();
  db.close();
  return n;
};

test('pagamento recusado: o ROLLBACK desfaz a reserva de stock, sem transação de compensação', async () => {
  const system = startSystem();
  await assert.rejects(system.app.checkout.checkout(portoOrder({ customerId: 'sem-saldo' })), { name: 'PaymentDeclinedError' });
  assert.equal(count(system.dbPath, 'inventory_stock_reservation'), 0);  // nem chegou a existir
  assert.equal(count(system.dbPath, 'checkout_customer_order'), 0);
  system.close();
});

test('com o serviço Kitchen desligado, o checkout continua: o bilhete vai direto para a base de dados', async () => {
  const system = startSystem();
  const call = client(system.url);
  const restartKitchen = system.stop('kitchen');

  const order = await call('POST', '/checkout', portoOrder());
  assert.equal(order.status, 201);
  assert.equal((await call('GET', '/kitchen/queue')).status, 503);

  restartKitchen();
  const [ticket] = (await call('GET', '/kitchen/queue')).body;
  assert.equal(ticket.orderId, order.body.id);
  system.close();
});

test('duas instâncias do Orders atrás do gateway veem as mesmas encomendas', async () => {
  const system = startSystem({ ordersInstances: 2 });
  const call = client(system.url);
  const first = (await call('POST', '/checkout', portoOrder())).body;    // instância 1
  const second = (await call('POST', '/checkout', portoOrder())).body;   // instância 2
  assert.equal(second.id, first.id + 1);
  const [one, two] = system.orders;
  assert.equal(two.checkout.getOrder(first.id).totalCents, 1350);
  assert.equal(one.checkout.getOrder(second.id).totalCents, 1350);
  system.close();
});
