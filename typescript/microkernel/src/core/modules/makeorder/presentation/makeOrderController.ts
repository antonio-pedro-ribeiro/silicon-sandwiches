// Rotas de MakeOrder.
import type { Router } from '../../../shared/http.ts';
import type { MakeOrderService } from '../business/makeOrderService.ts';

export function registerMakeOrderRoutes(router: Router, makeOrderService: MakeOrderService): void {
  router.get('/kitchen/queue', async ({ query }) => ({
    body: await makeOrderService.getQueue(query.get('storeId')),
  }));
  router.post('/kitchen/tickets/:id/advance', async ({ params }) => ({
    body: await makeOrderService.advance(Number(params.id)),
  }));
}
