// Checkout: uma saga orquestrada pelo próprio serviço (um mediador local, não um orquestrador central).
// Cada passo é um pedido HTTP a outro serviço, cada um com a sua base de dados, por isso não há uma
// transação que abranja tudo. Se o pagamento falhar depois de o stock estar reservado, a reserva é
// desfeita com uma transação de compensação (release).
// No fim, em vez de chamar a cozinha, a entrega e as promoções, publica o evento OrderPlaced e cada
// um desses serviços reage por si (coreografia).
import { NotFoundError, PaymentDeclinedError, ValidationError } from '../../../../platform/errors.js';

const FULFILMENTS = ['pickup', 'delivery'];

export function createCheckoutService({ catalog, orders, outbox, events, payment, location, inventory, promotion, delivery }) {
  async function checkout(request) {
    const req = validate(request);

    // 1. A loja existe e está aberta? (serviço Location)
    const store = await location.getStore(req.storeId);
    if (!store) throw new NotFoundError(`Loja desconhecida: ${req.storeId}`);
    if (!store.open) throw new ValidationError(`A loja ${store.name} está fechada`);

    // 2. Preços do menu desta loja, já com a personalização local (base de dados deste serviço)
    const menu = new Map(catalog.menuFor(store.id).map((item) => [item.id, item]));
    const lines = req.items.map(({ sandwichId, quantity }) => {
      const item = menu.get(sandwichId);
      if (!item) throw new ValidationError(`"${sandwichId}" não está no menu de ${store.name}`);
      return { sandwichId, name: item.name, quantity, unitPriceCents: item.priceCents };
    });
    const subtotalCents = lines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0);

    // 3. Desconto (serviço Promotion)
    let discountCents = 0;
    if (req.promoCode) {
      const promo = await promotion.discountFor({
        code: req.promoCode, storeId: store.id, customerId: req.customerId, subtotalCents,
      });
      if (!promo.valid) throw new ValidationError(promo.reason);
      discountCents = promo.discountCents;
    }

    // 4. Taxa de entrega (serviço Delivery)
    let deliveryFeeCents = 0;
    if (req.fulfilment === 'delivery') {
      const quote = await delivery.quote({ store });
      if (!quote.available) throw new ValidationError(quote.reason);
      deliveryFeeCents = quote.feeCents;
    }

    const totalCents = subtotalCents - discountCents + deliveryFeeCents;

    // 5. Reservar os ingredientes (serviço Inventory, que pede as receitas ao serviço Recipes)
    const stock = await inventory.reserve(store.id, lines);
    if (!stock.ok) throw new ValidationError(stock.reason);

    // 6. Pagamento (gateway externo). Se for recusado, compensa-se o passo 5: o Inventory liberta a reserva.
    const charge = await payment.charge({ customerId: req.customerId, amountCents: totalCents });
    if (!charge.approved) {
      await inventory.release(stock.reservationId).catch((err) => {
        console.error(`Compensação falhou: a reserva ${stock.reservationId} ficou por libertar (${err.message})`);
      });
      throw new PaymentDeclinedError(charge.reason);
    }

    // 7. Gravar a encomenda e, na mesma transação local, o evento OrderPlaced (outbox)
    const order = orders.create(
      {
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
      },
      (orderId) => outbox.add('OrderPlaced', {
        orderId,
        storeId: store.id,
        customerId: req.customerId,
        fulfilment: req.fulfilment,
        address: req.address,
        items: lines.map((l) => ({ name: l.name, quantity: l.quantity })),
        promoCode: req.promoCode,
        discountCents,
      }),
    );

    // 8. Publicar o evento (Promotion regista o código, Kitchen cria o bilhete, Delivery agenda a entrega).
    // Espera-se pela primeira tentativa, mas a encomenda não falha se um subscritor estiver em baixo:
    // o evento fica no outbox e volta a ser enviado mais tarde (consistência eventual).
    await events.dispatchPending();

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
