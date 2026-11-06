// API do serviço Delivery. /deliveries… é pública; /api/quotes é para o Checkout;
// /events/order-placed recebe o evento OrderPlaced.
import { ValidationError } from '../../../../platform/errors.ts';
import type { Router } from '../../../../platform/http.ts';
import type { DeliveryService } from '../business/deliveryService.ts';

// O que este serviço lê do evento OrderPlaced (o contrato é do lado de quem o consome).
interface OrderPlaced { orderId: number; storeId: string; fulfilment: string; address: string }

export function registerDeliveryApi(router: Router, deliveryService: DeliveryService): void {
  router.get('/deliveries', async () => ({ body: await deliveryService.list() }));
  router.post('/deliveries/:id/advance', async ({ params }) => ({
    body: await deliveryService.advance(Number(params.id)),
  }));

  // Passo 4 da saga do checkout: { store: { id, name } }
  router.post('/api/quotes', async ({ body }) => {
    const { store } = (body ?? {}) as { store?: { id?: unknown; name: string } };
    if (typeof store?.id !== 'string') throw new ValidationError('store.id é obrigatório');
    return { body: await deliveryService.quote({ store: { id: store.id, name: store.name } }) };
  });

  router.post('/events/order-placed', async ({ body }) => {
    const event = body as OrderPlaced;
    if (event.fulfilment !== 'delivery') return { body: { ignored: true } };
    return {
      body: await deliveryService.schedule({ orderId: event.orderId, storeId: event.storeId, address: event.address }),
    };
  });
}
