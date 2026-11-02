// Gravação e leitura de encomendas. A encomenda, as linhas e o que alsoInTransaction(id) gravar
// (o evento OrderPlaced, no outbox) entram na mesma transação: ou fica tudo gravado, ou nada.
import { rowsOf, transaction, type Database } from '../../../../platform/db.ts';

export type Fulfilment = 'pickup' | 'delivery';

export interface OrderLine {
  sandwichId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
}

export interface NewOrder {
  storeId: string;
  customerId: string;
  fulfilment: Fulfilment;
  lines: OrderLine[];
  subtotalCents: number;
  discountCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  promoCode?: string;
  paymentRef: string;
  status: string;
}

export interface Order extends Omit<NewOrder, 'promoCode'> {
  id: number;
  promoCode: string | null;
  createdAt: string;
}

interface OrderRow {
  id: number;
  store_id: string;
  customer_id: string;
  fulfilment: Fulfilment;
  subtotal_cents: number;
  discount_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  promo_code: string | null;
  payment_ref: string;
  status: string;
  created_at: string;
}
interface LineRow { sandwich_id: string; name: string; quantity: number; unit_price_cents: number }

export type OrderRepository = ReturnType<typeof createOrderRepository>;

export function createOrderRepository(db: Database) {
  const insertOrder = db.prepare(`
    INSERT INTO checkout_customer_order
      (store_id, customer_id, fulfilment, subtotal_cents, discount_cents,
       delivery_fee_cents, total_cents, promo_code, payment_ref, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertLine = db.prepare(`
    INSERT INTO checkout_order_line (order_id, sandwich_id, name, quantity, unit_price_cents)
    VALUES (?, ?, ?, ?, ?)`);
  const selectOrder = db.prepare('SELECT * FROM checkout_customer_order WHERE id = ?');
  const selectLines = db.prepare(
    'SELECT sandwich_id, name, quantity, unit_price_cents FROM checkout_order_line WHERE order_id = ? ORDER BY sandwich_id',
  );

  function create(order: NewOrder, alsoInTransaction?: (orderId: number) => void): Order {
    const id = transaction(db, () => {
      const { lastInsertRowid } = insertOrder.run(
        order.storeId,
        order.customerId,
        order.fulfilment,
        order.subtotalCents,
        order.discountCents,
        order.deliveryFeeCents,
        order.totalCents,
        order.promoCode ?? null,
        order.paymentRef,
        order.status,
      );
      for (const line of order.lines) {
        insertLine.run(lastInsertRowid, line.sandwichId, line.name, line.quantity, line.unitPriceCents);
      }
      alsoInTransaction?.(Number(lastInsertRowid));
      return Number(lastInsertRowid);
    });
    return findById(id)!;
  }

  function findById(id: number): Order | undefined {
    const row = selectOrder.get(id) as OrderRow | undefined;
    if (!row) return undefined;
    return {
      id: row.id,
      storeId: row.store_id,
      customerId: row.customer_id,
      fulfilment: row.fulfilment,
      status: row.status,
      lines: rowsOf<LineRow>(selectLines.all(id)).map((l) => ({
        sandwichId: l.sandwich_id,
        name: l.name,
        quantity: l.quantity,
        unitPriceCents: l.unit_price_cents,
      })),
      subtotalCents: row.subtotal_cents,
      discountCents: row.discount_cents,
      deliveryFeeCents: row.delivery_fee_cents,
      totalCents: row.total_cents,
      promoCode: row.promo_code,
      paymentRef: row.payment_ref,
      createdAt: row.created_at,
    };
  }

  return { create, findById };
}
