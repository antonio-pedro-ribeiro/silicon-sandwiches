// API do serviço Promotion. /promotions é pública; /api/discounts é para o Checkout;
// /events/order-placed recebe o evento OrderPlaced.
import { ValidationError } from '../../../../platform/errors.js';

export function registerPromotionApi(router, promotionService) {
  router.get('/promotions', async () => ({ body: await promotionService.list() }));

  // Passo 3 da saga do checkout: { code, storeId, customerId, subtotalCents }
  router.post('/api/discounts', async ({ body }) => {
    if (typeof body?.code !== 'string' || !Number.isInteger(body.subtotalCents)) {
      throw new ValidationError('code e subtotalCents são obrigatórios');
    }
    return { body: await promotionService.discountFor(body) };
  });

  router.post('/events/order-placed', async ({ body: event }) => {
    if (!event.promoCode) return { body: { ignored: true } };
    await promotionService.redeem({
      code: event.promoCode, customerId: event.customerId, orderId: event.orderId, discountCents: event.discountCents,
    });
    return { body: { redeemed: event.promoCode } };
  });
}
