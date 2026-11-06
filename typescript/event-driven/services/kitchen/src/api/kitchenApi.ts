// API do serviço Kitchen. /kitchen/… é pública; /events/order-placed recebe o evento OrderPlaced.
import type { Router } from '../../../../platform/http.ts';
import type { MakeOrderService } from '../business/makeOrderService.ts';

// O que este serviço lê do evento OrderPlaced (o contrato é do lado de quem o consome).
interface OrderPlaced { orderId: number; storeId: string; items: { name: string; quantity: number }[] }

export function registerKitchenApi(router: Router, makeOrderService: MakeOrderService): void {
  router.get('/kitchen/queue', async ({ query }) => ({ body: await makeOrderService.getQueue(query.get('storeId')) }));
  router.post('/kitchen/tickets/:id/advance', async ({ params }) => ({
    body: await makeOrderService.advance(Number(params.id)),
  }));

  router.post('/events/order-placed', async ({ body }) => {
    const event = body as OrderPlaced;
    return { body: await makeOrderService.enqueue({ orderId: event.orderId, storeId: event.storeId, items: event.items }) };
  });
}
