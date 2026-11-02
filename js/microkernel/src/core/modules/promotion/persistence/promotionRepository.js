// Utilizações dos códigos. Os códigos em si (e as regras) são plug-ins.
export function createPromotionRepository(db) {
  const usesBy = db.prepare('SELECT COUNT(*) AS n FROM promotion_redemption WHERE code = ? AND customer_id = ?');
  const insertRedemption = db.prepare(
    'INSERT INTO promotion_redemption (code, customer_id, order_id, discount_cents) VALUES (?, ?, ?, ?)',
  );

  return {
    countUses: (code, customerId) => usesBy.get(code, customerId).n,
    addRedemption: ({ code, customerId, orderId, discountCents }) =>
      insertRedemption.run(code, customerId, orderId, discountCents),
  };
}
