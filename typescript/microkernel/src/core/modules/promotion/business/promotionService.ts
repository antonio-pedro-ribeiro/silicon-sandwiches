// Promotion (núcleo): procura o plug-in do código e pede-lhe o desconto. As regras de cada código
// (loja, mínimo, limite por cliente) estão no plug-in; o núcleo só lê e passa as utilizações.
import type { PluginHost } from '../../../plugins/pluginHost.ts';
import type { PromotionResult } from '../../../plugins/contracts.ts';
import type { PromotionRepository, Redemption } from '../persistence/promotionRepository.ts';

export type Discount = PromotionResult;

export interface DiscountRequest {
  code: string;
  storeId: string;
  customerId: string;
  subtotalCents: number;
}

export type PromotionService = ReturnType<typeof createPromotionService>;

export function createPromotionService(
  { promotionRepository, plugins }: { promotionRepository: PromotionRepository; plugins: Pick<PluginHost, 'promotion' | 'promotions'> },
) {
  return {
    async discountFor({ code, storeId, customerId, subtotalCents }: DiscountRequest): Promise<Discount> {
      const plugin = plugins.promotion(code);
      if (!plugin) return { valid: false, reason: `Código promocional inválido: ${code}` };
      const timesUsed = promotionRepository.countUses(code, customerId);
      return plugin.evaluate({ storeId, customerId, subtotalCents, timesUsed });
    },
    async redeem({ code, customerId, orderId, discountCents }: Redemption): Promise<void> {
      promotionRepository.addRedemption({ code, customerId, orderId, discountCents });
    },
    async list(): Promise<{ code: string; description: string }[]> {
      return plugins.promotions().map(({ code, description }) => ({ code, description }));
    },
  };
}
