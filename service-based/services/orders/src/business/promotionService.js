// Promotion: valida códigos (loja, mínimo, limite por cliente) e regista cada utilização.
export function createPromotionService({ promotionRepository }) {
  return {
    async discountFor({ code, storeId, customerId, subtotalCents }) {
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
        : Math.min(promo.amountCents, subtotalCents);
      return { valid: true, discountCents };
    },
    async redeem({ code, customerId, orderId, discountCents }) {
      promotionRepository.addRedemption({ code, customerId, orderId, discountCents });
    },
    async list() {
      return promotionRepository.findActive();
    },
  };
}
