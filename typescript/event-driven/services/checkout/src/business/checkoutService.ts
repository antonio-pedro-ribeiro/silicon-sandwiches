// Checkout: uma saga orquestrada pelo próprio serviço (um mediador local, não um orquestrador central).
// Cada passo é um pedido HTTP a outro serviço, cada um com a sua base de dados, por isso não há uma
// transação que abranja tudo. Se o pagamento falhar depois de o stock estar reservado, a reserva é
// desfeita com uma transação de compensação (release).
// No fim, em vez de chamar a cozinha, a entrega e as promoções, publica o evento OrderPlaced e cada
// um desses serviços reage por si (coreografia).
import { NotFoundError, PaymentDeclinedError, ValidationError } from '../../../../platform/errors.ts';
import type { Fulfilment, NewOrder, Order } from '../persistence/orderRepository.ts';
import type { EventType } from '../persistence/outboxRepository.ts';

const FULFILMENTS: readonly Fulfilment[] = ['pickup', 'delivery'];

export interface CheckoutRequest {
  storeId: string;
  customerId: string;
  items: { sandwichId: string; quantity: number }[];
  promoCode?: string;
  fulfilment: Fulfilment;
  address?: string;
}

// O evento que o Checkout publica. Cada subscritor lê dele só o que precisa.
export interface OrderPlaced {
  orderId: number;
  storeId: string;
  customerId: string;
  fulfilment: Fulfilment;
  address?: string;
  items: { name: string; quantity: number }[];
  promoCode?: string;
  discountCents: number;
}

type StoreInfo = { id: string; name: string; open: boolean };
type Rejection = { reason: string };

// Cada dependência é descrita só pelo que o checkout usa dela (tipos estruturais).
export interface CheckoutDependencies {
  catalog: { menuFor(storeId: string): { id: string; name: string; priceCents: number }[] };
  orders: {
    create(order: NewOrder, alsoInTransaction?: (orderId: number) => void): Order;
    findById(id: number): Order | undefined;
  };
  outbox: { add(type: EventType, payload: OrderPlaced): unknown };
  events: { dispatchPending(): Promise<void> };
  payment: {
    charge(req: { customerId: string; amountCents: number }): Promise<{ approved: true; ref: string } | ({ approved: false } & Rejection)>;
  };
  location: { getStore(id: string): Promise<StoreInfo | undefined> };
  inventory: {
    reserve(storeId: string, lines: { sandwichId: string; name: string; quantity: number }[]): Promise<{ ok: true; reservationId: number } | ({ ok: false } & Rejection)>;
    release(reservationId: number): Promise<unknown>;
  };
  promotion: {
    discountFor(req: { code: string; storeId: string; customerId: string; subtotalCents: number }): Promise<{ valid: true; discountCents: number } | ({ valid: false } & Rejection)>;
  };
  delivery: {
    quote(req: { store: StoreInfo }): Promise<{ available: true; feeCents: number } | ({ available: false } & Rejection)>;
  };
}

export type CheckoutService = ReturnType<typeof createCheckoutService>;

export function createCheckoutService(
  { catalog, orders, outbox, events, payment, location, inventory, promotion, delivery }: CheckoutDependencies,
) {
  async function checkout(request: unknown): Promise<Order> {
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
      await inventory.release(stock.reservationId).catch((err: Error) => {
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

  function getOrder(id: number): Order {
    const order = orders.findById(id);
    if (!order) throw new NotFoundError(`Encomenda ${id} não existe`);
    return order;
  }

  return { checkout, getOrder };
}

// O pedido chega da rede: só depois de validado passa a ser um CheckoutRequest.
function validate(body: unknown): CheckoutRequest {
  if (!body || typeof body !== 'object') throw new ValidationError('Pedido vazio');
  const { storeId, customerId, items, promoCode, fulfilment = 'pickup', address } = body as Record<string, unknown>;

  if (typeof storeId !== 'string' || !storeId) throw new ValidationError('storeId é obrigatório');
  if (typeof customerId !== 'string' || !customerId) throw new ValidationError('customerId é obrigatório');
  if (!Array.isArray(items) || items.length === 0) throw new ValidationError('A encomenda não tem artigos');
  if (!FULFILMENTS.includes(fulfilment as Fulfilment)) throw new ValidationError(`fulfilment tem de ser ${FULFILMENTS.join(' ou ')}`);
  if (fulfilment === 'delivery' && !address) throw new ValidationError('A entrega ao domicílio precisa de morada');

  // Junta linhas repetidas da mesma sandes
  const quantities = new Map<string, number>();
  for (const item of items as { sandwichId?: unknown; quantity?: unknown }[]) {
    if (typeof item?.sandwichId !== 'string' || typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new ValidationError('Cada artigo precisa de sandwichId e de uma quantity inteira positiva');
    }
    quantities.set(item.sandwichId, (quantities.get(item.sandwichId) ?? 0) + item.quantity);
  }

  return {
    storeId,
    customerId,
    promoCode: promoCode as string | undefined,
    fulfilment: fulfilment as Fulfilment,
    address: address as string | undefined,
    items: [...quantities].map(([sandwichId, quantity]) => ({ sandwichId, quantity })),
  };
}
