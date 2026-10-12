// Checkout: orquestra os outros componentes, que chegam por injeção.
// O pagamento (gateway externo) é o único que continua simulado.
import { NotFoundError, PaymentDeclinedError, ValidationError } from './errors.js';

const FULFILMENTS = ['pickup', 'delivery'];

export function createCheckoutService({
  catalog, orders, payment, location, inventory, promotion, makeOrder, delivery,
}) {
  async function checkout(request) {
    const req = validate(request);

    // 1. A loja existe e está aberta? (Location)
    const store = await location.getStore(req.storeId);
    if (!store) throw new NotFoundError(`Loja desconhecida: ${req.storeId}`);
    if (!store.open) throw new ValidationError(`A loja ${store.name} está fechada`);

    // 2. Preços do menu desta loja, já com a personalização local (Catalog)
    const menu = new Map(catalog.menuFor(store.id).map((item) => [item.id, item]));
    const lines = req.items.map(({ sandwichId, quantity }) => {
      const item = menu.get(sandwichId);
      if (!item) throw new ValidationError(`"${sandwichId}" não está no menu de ${store.name}`);
      return { sandwichId, name: item.name, quantity, unitPriceCents: item.priceCents };
    });
    const subtotalCents = lines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0);

    // 3. Desconto (Promotion)
    let discountCents = 0;
    if (req.promoCode) {
      const promo = await promotion.discountFor({
        code: req.promoCode, storeId: store.id, customerId: req.customerId, subtotalCents,
      });
      if (!promo.valid) throw new ValidationError(promo.reason);
      discountCents = promo.discountCents;
    }

    // 4. Taxa de entrega (Delivery)
    let deliveryFeeCents = 0;
    if (req.fulfilment === 'delivery') {
      const quote = await delivery.quote({ store, address: req.address });
      if (!quote.available) throw new ValidationError(quote.reason);
      deliveryFeeCents = quote.feeCents;
    }

    const totalCents = subtotalCents - discountCents + deliveryFeeCents;

    // 5. Reservar os ingredientes (ManageInventory, que consulta Recipes)
    const stock = await inventory.reserve(store.id, lines);
    if (!stock.ok) throw new ValidationError(stock.reason);

    // 6. Pagamento (gateway externo). Se falhar, devolve-se o stock (compensação).
    const charge = await payment.charge({ customerId: req.customerId, amountCents: totalCents });
    if (!charge.approved) {
      await inventory.release(stock.reservationId);
      throw new PaymentDeclinedError(charge.reason);
    }

    // 7. Gravar a encomenda (uma transação SQL)
    const order = orders.create({
      storeId: store.id,
      customerId: req.customerId,
      fulfilment: req.fulfilment,
      lines,
      subtotalCents,
      discountCents,
      deliveryFeeCents,
      totalCents,
      promoCode: req.promoCode,
      paymentRef: charge.ref,
      status: 'PLACED',
    });

    // 8. Registar o código usado (Promotion), avisar a cozinha (MakeOrder) e agendar a entrega (Delivery)
    if (req.promoCode) {
      await promotion.redeem({ code: req.promoCode, customerId: req.customerId, orderId: order.id, discountCents });
    }
    await makeOrder.enqueue(order);
    if (order.fulfilment === 'delivery') await delivery.schedule({ order, address: req.address });

    return order;
  }

  function getOrder(id) {
    const order = orders.findById(id);
    if (!order) throw new NotFoundError(`Encomenda ${id} não existe`);
    return order;
  }

  return { checkout, getOrder };
}

function validate(body) {
  if (!body || typeof body !== 'object') throw new ValidationError('Pedido vazio');
  const { storeId, customerId, items, promoCode, fulfilment = 'pickup', address } = body;

  if (typeof storeId !== 'string' || !storeId) throw new ValidationError('storeId é obrigatório');
  if (typeof customerId !== 'string' || !customerId) throw new ValidationError('customerId é obrigatório');
  if (!Array.isArray(items) || items.length === 0) throw new ValidationError('A encomenda não tem artigos');
  if (!FULFILMENTS.includes(fulfilment)) throw new ValidationError(`fulfilment tem de ser ${FULFILMENTS.join(' ou ')}`);
  if (fulfilment === 'delivery' && !address) throw new ValidationError('A entrega ao domicílio precisa de morada');

  // Junta linhas repetidas da mesma sandes
  const quantities = new Map();
  for (const item of items) {
    if (typeof item?.sandwichId !== 'string' || !Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new ValidationError('Cada artigo precisa de sandwichId e de uma quantity inteira positiva');
    }
    quantities.set(item.sandwichId, (quantities.get(item.sandwichId) ?? 0) + item.quantity);
  }

  return {
    storeId,
    customerId,
    promoCode,
    fulfilment,
    address,
    items: [...quantities].map(([sandwichId, quantity]) => ({ sandwichId, quantity })),
  };
}
