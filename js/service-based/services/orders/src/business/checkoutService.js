// Checkout: a fachada do serviço Orders orquestra o pedido de ponta a ponta, dentro do serviço.
// Não chama nenhum outro serviço: lê e escreve as tabelas de que precisa (lojas, stock, cozinha,
// entregas) pelas bibliotecas de entidades de cada partição da base de dados partilhada.
// Por isso os passos 5 a 8 são UMA transação ACID: se algo falhar, ROLLBACK e não fica nada a meio.
import { transactionAsync } from '../../../../libs/platform/db.js';
import { NotFoundError, PaymentDeclinedError, ValidationError } from '../../../../libs/platform/errors.js';

const FULFILMENTS = ['pickup', 'delivery'];

export function createCheckoutService({ db, catalog, promotion, payment, entities }) {
  const { stores, orders, promotions, stock, recipes, kitchen, deliveries } = entities;

  async function checkout(request) {
    const req = validate(request);

    // 1. A loja existe e está aberta? (partição common)
    const store = stores.findById(req.storeId);
    if (!store) throw new NotFoundError(`Loja desconhecida: ${req.storeId}`);
    if (!store.open) throw new ValidationError(`A loja ${store.name} está fechada`);

    // 2. Preços do menu desta loja, já com a personalização local (partição orders)
    const menu = new Map(catalog.menuFor(store.id).map((item) => [item.id, item]));
    const lines = req.items.map(({ sandwichId, quantity }) => {
      const item = menu.get(sandwichId);
      if (!item) throw new ValidationError(`"${sandwichId}" não está no menu de ${store.name}`);
      return { sandwichId, name: item.name, quantity, unitPriceCents: item.priceCents };
    });
    const subtotalCents = lines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0);

    // 3. Desconto (partição orders)
    let discountCents = 0;
    if (req.promoCode) {
      const promo = await promotion.discountFor({
        code: req.promoCode, storeId: store.id, customerId: req.customerId, subtotalCents,
      });
      if (!promo.valid) throw new ValidationError(promo.reason);
      discountCents = promo.discountCents;
    }

    // 4. Taxa de entrega (partição delivery)
    const zone = req.fulfilment === 'delivery' ? deliveries.findZone(store.id) : undefined;
    if (req.fulfilment === 'delivery' && !zone) throw new ValidationError(`A loja ${store.name} não faz entregas`);
    const deliveryFeeCents = zone?.feeCents ?? 0;

    const totalCents = subtotalCents - discountCents + deliveryFeeCents;

    return transactionAsync(db, async () => {
      // 5. Reservar os ingredientes, segundo as receitas (partição inventory)
      const reservation = stock.reserve(store.id, ingredientsFor(lines));
      if (!reservation.ok) throw new ValidationError(`Não há ${reservation.ingredient} suficiente em ${store.id}`);

      // 6. Pagamento (gateway externo). Se for recusado, o ROLLBACK devolve o stock: não há compensação.
      const charge = await payment.charge({ customerId: req.customerId, amountCents: totalCents });
      if (!charge.approved) throw new PaymentDeclinedError(charge.reason);

      // 7. Gravar a encomenda (partição orders)
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

      // 8. Registar o código usado, criar o bilhete da cozinha e a entrega (partições orders, kitchen, delivery)
      if (req.promoCode) {
        promotions.addRedemption({ code: req.promoCode, customerId: req.customerId, orderId: order.id, discountCents });
      }
      kitchen.create({
        orderId: order.id,
        storeId: store.id,
        items: lines.map((l) => ({ name: l.name, quantity: l.quantity })),
      });
      if (zone) {
        deliveries.create({ orderId: order.id, storeId: store.id, address: req.address, etaMinutes: zone.etaMinutes });
      }
      return order;
    });
  }

  // Converte as sandes nos ingredientes das receitas e devolve o que reservar (ou porque não dá).
  function ingredientsFor(lines) {
    const needs = new Map();
    for (const line of lines) {
      const recipe = recipes.findBySandwich(line.sandwichId);
      if (!recipe.length) throw new ValidationError(`Não há receita para ${line.name}`);
      for (const { ingredient, quantity } of recipe) {
        needs.set(ingredient, (needs.get(ingredient) ?? 0) + quantity * line.quantity);
      }
    }
    return [...needs].map(([ingredient, quantity]) => ({ ingredient, quantity }));
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
