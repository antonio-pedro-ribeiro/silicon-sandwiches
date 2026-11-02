// Códigos promocionais e utilizações.
import { rowsOf, type Database } from '../../../../platform/db.ts';

export interface Promotion {
  code: string;
  description: string;
  percent: number | null;
  amountCents: number | null;
  minSubtotalCents: number;
  storeId: string | null;
  maxUsesPerCustomer: number | null;
}

export interface Redemption {
  code: string;
  customerId: string;
  orderId: number;
  discountCents: number;
}

interface PromotionRow {
  code: string;
  description: string;
  percent: number | null;
  amount_cents: number | null;
  min_subtotal_cents: number;
  store_id: string | null;
  max_uses_per_customer: number | null;
}

export type PromotionRepository = ReturnType<typeof createPromotionRepository>;

export function createPromotionRepository(db: Database) {
  const active = db.prepare('SELECT * FROM promotion_code WHERE active = 1 ORDER BY code');
  const byCode = db.prepare('SELECT * FROM promotion_code WHERE code = ? AND active = 1');
  const usesBy = db.prepare('SELECT COUNT(*) AS n FROM promotion_redemption WHERE code = ? AND customer_id = ?');
  const insertRedemption = db.prepare(
    'INSERT OR IGNORE INTO promotion_redemption (code, customer_id, order_id, discount_cents) VALUES (?, ?, ?, ?)',
  );

  const toPromotion = (r: PromotionRow): Promotion => ({
    code: r.code,
    description: r.description,
    percent: r.percent,
    amountCents: r.amount_cents,
    minSubtotalCents: r.min_subtotal_cents,
    storeId: r.store_id,
    maxUsesPerCustomer: r.max_uses_per_customer,
  });

  return {
    findActive: (): Promotion[] => rowsOf<PromotionRow>(active.all()).map(toPromotion),
    findByCode: (code: string): Promotion | undefined => {
      const row = byCode.get(code) as PromotionRow | undefined;
      return row && toPromotion(row);
    },
    countUses: (code: string, customerId: string): number => (usesBy.get(code, customerId) as { n: number }).n,
    addRedemption: ({ code, customerId, orderId, discountCents }: Redemption) =>
      insertRedemption.run(code, customerId, orderId, discountCents),
  };
}
