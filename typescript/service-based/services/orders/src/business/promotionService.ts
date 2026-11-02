// Promotion: valida códigos (loja, mínimo, limite por cliente) e regista cada utilização.
import type { Promotion, PromotionRepository, Redemption } from '../../../../libs/orders-entities/index.ts';

export type Discount = { valid: true; discountCents: number } | { valid: false; reason: string };

export interface DiscountRequest {
  code: string;
  storeId: string;
  customerId: string;
  subtotalCents: number;
}

export type PromotionService = ReturnType<typeof createPromotionService>;

export function createPromotionService({ promotionRepository }: { promotionRepository: PromotionRepository }) {
  return {
    async discountFor({ code, storeId, customerId, subtotalCents }: DiscountRequest): Promise<Discount> {
      const promo = promotionRepository.findByCode(code);
      if (!promo) return { valid: false, reason: `Código promocional inválido: ${code}` };
      if (promo.storeId && promo.storeId !== storeId) {
        return { valid: false, reason: `${code} não é válido nesta loja` };
      }
      if (subtotalCents < promo.minSubtotalCents) {
        return { valid: false, reason: `${code} só se aplica a partir de ${promo.minSubtotalCents / 100} €` };
      }
      if (promo.maxUsesPerCustomer && promotionRepository.countUses(code, customerId) >= promo.maxUsesPerCustomer) {
        return { valid: false, reason: `${customerId} já usou o código ${code}` };
      }
      const discountCents = promo.percent
        ? Math.round((subtotalCents * promo.percent) / 100)
        : Math.min(promo.amountCents ?? 0, subtotalCents);
      return { valid: true, discountCents };
    },
    async redeem({ code, customerId, orderId, discountCents }: Redemption): Promise<void> {
      promotionRepository.addRedemption({ code, customerId, orderId, discountCents });
    },
    async list(): Promise<Promotion[]> {
      return promotionRepository.findActive();
    },
  };
}
