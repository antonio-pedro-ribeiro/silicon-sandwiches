// Utilizações dos códigos. Os códigos em si (e as regras) são plug-ins.
import type { Database } from '../../../shared/db.ts';

export interface Redemption {
  code: string;
  customerId: string;
  orderId: number;
  discountCents: number;
}

export type PromotionRepository = ReturnType<typeof createPromotionRepository>;

export function createPromotionRepository(db: Database) {
  const usesBy = db.prepare('SELECT COUNT(*) AS n FROM promotion_redemption WHERE code = ? AND customer_id = ?');
  const insertRedemption = db.prepare(
    'INSERT INTO promotion_redemption (code, customer_id, order_id, discount_cents) VALUES (?, ?, ?, ?)',
  );

  return {
    countUses: (code: string, customerId: string): number => (usesBy.get(code, customerId) as { n: number }).n,
    addRedemption: ({ code, customerId, orderId, discountCents }: Redemption) =>
      insertRedemption.run(code, customerId, orderId, discountCents),
  };
}
