// API do serviço Promotion. /promotions é pública; /api/discounts é para o Checkout;
// /events/order-placed recebe o evento OrderPlaced.
import { ValidationError } from '../../../../platform/errors.ts';
import type { Router } from '../../../../platform/http.ts';
import type { DiscountRequest, PromotionService } from '../business/promotionService.ts';

// O que este serviço lê do evento OrderPlaced (o contrato é do lado de quem o consome).
interface OrderPlaced { orderId: number; customerId: string; promoCode?: string; discountCents: number }

export function registerPromotionApi(router: Router, promotionService: PromotionService): void {
  router.get('/promotions', async () => ({ body: await promotionService.list() }));

  // Passo 3 da saga do checkout: { code, storeId, customerId, subtotalCents }
  router.post('/api/discounts', async ({ body }) => {
    const query = (body ?? {}) as Partial<Record<keyof DiscountRequest, unknown>>;
    if (typeof query.code !== 'string' || !Number.isInteger(query.subtotalCents)) {
      throw new ValidationError('code e subtotalCents são obrigatórios');
    }
    return { body: await promotionService.discountFor(query as DiscountRequest) };
  });

  router.post('/events/order-placed', async ({ body }) => {
    const event = body as OrderPlaced;
    if (!event.promoCode) return { body: { ignored: true } };
    await promotionService.redeem({
      code: event.promoCode, customerId: event.customerId, orderId: event.orderId, discountCents: event.discountCents,
    });
    return { body: { redeemed: event.promoCode } };
  });
}
