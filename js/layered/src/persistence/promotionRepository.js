// Códigos promocionais e utilizações.
export function createPromotionRepository(db) {
  const active = db.prepare('SELECT * FROM promotion_code WHERE active = 1 ORDER BY code');
  const byCode = db.prepare('SELECT * FROM promotion_code WHERE code = ? AND active = 1');
  const usesBy = db.prepare('SELECT COUNT(*) AS n FROM promotion_redemption WHERE code = ? AND customer_id = ?');
  const insertRedemption = db.prepare(
    'INSERT INTO promotion_redemption (code, customer_id, order_id, discount_cents) VALUES (?, ?, ?, ?)',
  );

  const toPromotion = (r) => r && {
    code: r.code,
    description: r.description,
    percent: r.percent,
    amountCents: r.amount_cents,
    minSubtotalCents: r.min_subtotal_cents,
    storeId: r.store_id,
    maxUsesPerCustomer: r.max_uses_per_customer,
  };

  return {
    findActive: () => active.all().map(toPromotion),
    findByCode: (code) => toPromotion(byCode.get(code)),
    countUses: (code, customerId) => usesBy.get(code, customerId).n,
    addRedemption: ({ code, customerId, orderId, discountCents }) =>
      insertRedemption.run(code, customerId, orderId, discountCents),
  };
}
