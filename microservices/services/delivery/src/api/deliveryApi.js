// API do serviço Delivery. /deliveries… é pública; /api/quotes é para o Checkout;
// /events/order-placed recebe o evento OrderPlaced.
import { ValidationError } from '../../../../platform/errors.js';

export function registerDeliveryApi(router, deliveryService) {
  router.get('/deliveries', async () => ({ body: await deliveryService.list() }));
  router.post('/deliveries/:id/advance', async ({ params }) => ({
    body: await deliveryService.advance(Number(params.id)),
  }));

  // Passo 4 da saga do checkout: { store: { id, name } }
  router.post('/api/quotes', async ({ body }) => {
    if (typeof body?.store?.id !== 'string') throw new ValidationError('store.id é obrigatório');
    return { body: await deliveryService.quote({ store: body.store }) };
  });

  router.post('/events/order-placed', async ({ body: event }) => {
    if (event.fulfilment !== 'delivery') return { body: { ignored: true } };
    return {
      body: await deliveryService.schedule({ orderId: event.orderId, storeId: event.storeId, address: event.address }),
    };
  });
}
