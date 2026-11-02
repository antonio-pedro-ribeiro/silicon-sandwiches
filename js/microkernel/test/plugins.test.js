// Testes próprios do microkernel: cada plug-in testa-se sozinho, e o núcleo funciona sem plug-ins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createPluginHost } from '../src/core/plugins/pluginHost.js';
import porto15 from '../src/plugins/promotion/porto15/index.js';
import bemvindo from '../src/plugins/promotion/bemvindo/index.js';
import lisboa from '../src/plugins/store/lisboa-campo-grande/index.js';

process.env.SILENT = '1';

// --- Um plug-in de cada vez, sem núcleo nem base de dados ----------------------------------

test('PORTO15 sozinho: 15% nos Aliados, recusado noutra loja', () => {
  assert.deepEqual(porto15.evaluate({ storeId: 'porto-aliados', subtotalCents: 1000 }), { valid: true, discountCents: 150 });
  assert.equal(porto15.evaluate({ storeId: 'lisboa-campo-grande', subtotalCents: 1000 }).valid, false);
});

test('BEMVINDO sozinho: a contagem de utilizações chega do núcleo', () => {
  assert.equal(bemvindo.evaluate({ customerId: 'rui', subtotalCents: 900, timesUsed: 0 }).valid, true);
  assert.equal(bemvindo.evaluate({ customerId: 'rui', subtotalCents: 900, timesUsed: 1 }).valid, false);
});

test('o plug-in de Lisboa tira o prego e muda o preço da bifana', () => {
  const common = [{ id: 'bifana', name: 'Bifana', priceCents: 450 }, { id: 'prego', name: 'Prego no pão', priceCents: 550 }];
  assert.deepEqual(lisboa.menu(common), [{ id: 'bifana', name: 'Bifana', priceCents: 480 }]);
});

// --- O núcleo ------------------------------------------------------------------------------

test('um plug-in que não cumpre o contrato é recusado no arranque', () => {
  assert.throws(
    () => createPluginHost([{ name: 'promotion/natal', contract: 'promotion', code: 'NATAL' }]),
    /evaluate tem de ser function/,
  );
});

test('sem plug-ins, o núcleo faz só o caminho feliz: menu comum, sem entregas, sem códigos', async () => {
  const app = createApp({ plugins: [] });
  assert.deepEqual(
    app.checkout.menuFor('porto-aliados').map((i) => i.id),
    ['bifana', 'prego', 'tosta-mista', 'wrap-vegan'],
  );
  const order = { storeId: 'porto-aliados', customerId: 'ana', items: [{ sandwichId: 'bifana', quantity: 1 }] };
  assert.equal((await app.checkout.checkout(order)).totalCents, 450);
  await assert.rejects(
    app.checkout.checkout({ ...order, fulfilment: 'delivery', address: 'Rua das Flores, 1' }),
    /não faz entregas/,
  );
  await assert.rejects(app.checkout.checkout({ ...order, promoCode: 'FCUL10' }), /inválido/);
  app.close();
});

test('acrescentar um plug-in não mexe no núcleo: um código novo passa a valer', async () => {
  const natal = {
    name: 'promotion/natal',
    contract: 'promotion',
    code: 'NATAL',
    description: '50% no Natal',
    evaluate: ({ subtotalCents }) => ({ valid: true, discountCents: subtotalCents / 2 }),
  };
  const app = createApp({ plugins: [natal] });
  const order = await app.checkout.checkout({
    storeId: 'porto-aliados', customerId: 'ana', items: [{ sandwichId: 'tosta-mista', quantity: 2 }], promoCode: 'NATAL',
  });
  assert.equal(order.totalCents, 350);
  app.close();
});
