import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../src/app.js';

// Arranca o serviço (BD em memória) num porto livre e devolve um cliente HTTP mínimo.
async function withServer(run) {
  const app = createApp();
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
    await run({ get: (p) => call('GET', p), post: (p, b) => call('POST', p, b) });
  } finally {
    server.close();
    app.close();
  }
}

test('POST /api/quotes dá a taxa do Porto e recusa Coimbra', async () => {
  await withServer(async ({ post }) => {
    const porto = await post('/api/quotes', { store: { id: 'porto-aliados', name: 'Porto · Aliados' } });
    assert.deepEqual(porto.body, { available: true, feeCents: 250, etaMinutes: 30 });
    const coimbra = await post('/api/quotes', { store: { id: 'coimbra-baixa', name: 'Coimbra · Baixa' } });
    assert.equal(coimbra.body.available, false);
  });
});

test('POST /api/deliveries agenda uma entrega, que avança até DELIVERED', async () => {
  await withServer(async ({ get, post }) => {
    const created = await post('/api/deliveries', {
      order: { id: 7, storeId: 'porto-aliados' }, address: 'Rua das Flores, 1',
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, 'SCHEDULED');

    const [job] = (await get('/deliveries')).body;
    assert.equal(job.orderId, 7);
    assert.equal((await post(`/deliveries/${job.id}/advance`)).body.status, 'OUT_FOR_DELIVERY');
    assert.equal((await post(`/deliveries/${job.id}/advance`)).body.status, 'DELIVERED');
    assert.equal((await post(`/deliveries/${job.id}/advance`)).status, 422);
  });
});

test('o contrato rejeita pedidos incompletos com 422', async () => {
  await withServer(async ({ post }) => {
    assert.equal((await post('/api/quotes', {})).status, 422);
    assert.equal((await post('/api/deliveries', { order: { id: 1 } })).status, 422);
    assert.equal((await post('/deliveries/99/advance')).status, 404);
  });
});
