// Demonstração para a aula: vários checkouts seguidos, com base de dados em memória (começa sempre do zero).
import { createApp } from '../src/app.js';

const app = createApp();
const euros = (cents) => `${(cents / 100).toFixed(2).replace('.', ',')} €`;

async function attempt(title, request) {
  console.log(`\n▶ ${title}`);
  try {
    const o = await app.checkout.checkout(request);
    for (const l of o.lines) console.log(`    ${l.quantity}× ${l.name} a ${euros(l.unitPriceCents)}`);
    console.log(
      `  ✔ Encomenda #${o.id} (${o.fulfilment}): ${euros(o.subtotalCents)} − ${euros(o.discountCents)}` +
        ` + ${euros(o.deliveryFeeCents)} = ${euros(o.totalCents)}`,
    );
  } catch (err) {
    console.log(`  ✘ ${err.name}: ${err.message}`);
  }
}

await attempt('Porto: francesinha + 2 tostas, código FCUL10, entrega ao domicílio', {
  storeId: 'porto-aliados',
  customerId: 'ana',
  items: [{ sandwichId: 'francesinha', quantity: 1 }, { sandwichId: 'tosta-mista', quantity: 2 }],
  promoCode: 'FCUL10',
  fulfilment: 'delivery',
  address: 'Rua de Santa Catarina, 100, Porto',
});

await attempt('Lisboa: bifana (preço local), levantamento na loja', {
  storeId: 'lisboa-campo-grande',
  customerId: 'rui',
  items: [{ sandwichId: 'bifana', quantity: 2 }],
});

await attempt('Lisboa: francesinha (só existe no Porto)', {
  storeId: 'lisboa-campo-grande',
  customerId: 'rui',
  items: [{ sandwichId: 'francesinha', quantity: 1 }],
});

await attempt('Coimbra: loja fechada', {
  storeId: 'coimbra-baixa',
  customerId: 'ines',
  items: [{ sandwichId: 'tosta-mista', quantity: 1 }],
});

await attempt('Porto: pagamento recusado', {
  storeId: 'porto-aliados',
  customerId: 'sem-saldo',
  items: [{ sandwichId: 'prego', quantity: 1 }],
});

await attempt('Lisboa: código PORTO15 (só vale no Porto)', {
  storeId: 'lisboa-campo-grande',
  customerId: 'rui',
  items: [{ sandwichId: 'bifana', quantity: 1 }],
  promoCode: 'PORTO15',
});

await attempt('Lisboa: BEMVINDO pela primeira vez', {
  storeId: 'lisboa-campo-grande',
  customerId: 'marta',
  items: [{ sandwichId: 'wrap-vegan', quantity: 2 }],
  promoCode: 'BEMVINDO',
});

await attempt('Lisboa: BEMVINDO pela segunda vez (limite de 1 por cliente)', {
  storeId: 'lisboa-campo-grande',
  customerId: 'marta',
  items: [{ sandwichId: 'wrap-vegan', quantity: 2 }],
  promoCode: 'BEMVINDO',
});

await attempt('Porto: 11 francesinhas (só há molho para 10)', {
  storeId: 'porto-aliados',
  customerId: 'ana',
  items: [{ sandwichId: 'francesinha', quantity: 11 }],
});

app.close();
