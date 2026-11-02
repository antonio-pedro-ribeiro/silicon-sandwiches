// Fachada do serviço Kitchen: a fila da cozinha.
import type { Router } from '../../../../libs/platform/http.ts';
import type { MakeOrderService } from '../business/makeOrderService.ts';

export function registerKitchenApi(router: Router, makeOrderService: MakeOrderService): void {
  router.get('/kitchen/queue', async ({ query }) => ({ body: await makeOrderService.getQueue(query.get('storeId')) }));
  router.post('/kitchen/tickets/:id/advance', async ({ params }) => ({
    body: await makeOrderService.advance(Number(params.id)),
  }));
}
