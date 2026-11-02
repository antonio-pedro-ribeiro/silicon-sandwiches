// Rotas de Delivery.
import type { Router } from './http.ts';
import type { DeliveryService } from '../business/deliveryService.ts';

export function registerDeliveryRoutes(router: Router, deliveryService: DeliveryService): void {
  router.get('/deliveries', async () => ({ body: await deliveryService.list() }));
  router.post('/deliveries/:id/advance', async ({ params }) => ({
    body: await deliveryService.advance(Number(params.id)),
  }));
}
