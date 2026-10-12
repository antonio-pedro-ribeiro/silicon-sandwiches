// Gravação e leitura de encomendas. A encomenda e as linhas entram na mesma transação.
import { transaction } from './db.js';

export function createOrderRepository(db) {
  const insertOrder = db.prepare(`
    INSERT INTO customer_order
      (store_id, customer_id, fulfilment, subtotal_cents, discount_cents,
       delivery_fee_cents, total_cents, promo_code, payment_ref, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertLine = db.prepare(`
    INSERT INTO order_line (order_id, sandwich_id, name, quantity, unit_price_cents)
    VALUES (?, ?, ?, ?, ?)`);
  const selectOrder = db.prepare('SELECT * FROM customer_order WHERE id = ?');
  const selectLines = db.prepare(
    'SELECT sandwich_id, name, quantity, unit_price_cents FROM order_line WHERE order_id = ? ORDER BY sandwich_id',
  );

  function create(order) {
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
      return Number(lastInsertRowid);
    });
    return findById(id);
  }

  function findById(id) {
    const row = selectOrder.get(id);
    if (!row) return undefined;
    return {
      id: row.id,
      storeId: row.store_id,
      customerId: row.customer_id,
      fulfilment: row.fulfilment,
      status: row.status,
      lines: selectLines.all(id).map((l) => ({
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
