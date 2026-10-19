// Promotion (núcleo): procura o plug-in do código e pede-lhe o desconto. As regras de cada código
// (loja, mínimo, limite por cliente) estão no plug-in; o núcleo só lê e passa as utilizações.
export function createPromotionService({ promotionRepository, plugins }) {
  return {
    async discountFor({ code, storeId, customerId, subtotalCents }) {
      const plugin = plugins.promotion(code);
      if (!plugin) return { valid: false, reason: `Código promocional inválido: ${code}` };
      const timesUsed = promotionRepository.countUses(code, customerId);
      return plugin.evaluate({ storeId, customerId, subtotalCents, timesUsed });
    },
    async redeem({ code, customerId, orderId, discountCents }) {
      promotionRepository.addRedemption({ code, customerId, orderId, discountCents });
    },
    async list() {
      return plugins.promotions().map(({ code, description }) => ({ code, description }));
    },
  };
}
