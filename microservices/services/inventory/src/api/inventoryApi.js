// API do serviço Inventory. /inventory/… é pública; /api/reservations… é só para o Checkout.
import { ValidationError } from '../../../../platform/errors.js';

export function registerInventoryApi(router, inventoryService) {
  router.get('/inventory/:storeId', async ({ params }) => ({ body: await inventoryService.stockFor(params.storeId) }));
  router.post('/inventory/:storeId/restock', async ({ params, body }) => ({
    body: await inventoryService.restock(params.storeId, body),
  }));

  // Passo 5 da saga do checkout: { storeId, lines: [{ sandwichId, name, quantity }] }
  router.post('/api/reservations', async ({ body }) => {
    if (typeof body?.storeId !== 'string' || !Array.isArray(body.lines)) {
      throw new ValidationError('storeId e lines são obrigatórios');
    }
    return { status: 201, body: await inventoryService.reserve(body.storeId, body.lines) };
  });
  // Compensação do passo 5, quando o pagamento é recusado
  router.post('/api/reservations/:id/release', async ({ params }) => ({
    body: { released: await inventoryService.release(Number(params.id)) },
  }));
}
