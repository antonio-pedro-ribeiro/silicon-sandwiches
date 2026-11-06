// API do serviço Inventory. /inventory/… é pública; /api/reservations… é só para o Checkout.
import { ValidationError } from '../../../../platform/errors.ts';
import type { Router } from '../../../../platform/http.ts';
import type { InventoryService } from '../business/inventoryService.ts';

type ReservationLine = { sandwichId: string; name: string; quantity: number };

export function registerInventoryApi(router: Router, inventoryService: InventoryService): void {
  router.get('/inventory/:storeId', async ({ params }) => ({ body: await inventoryService.stockFor(params.storeId) }));
  router.post('/inventory/:storeId/restock', async ({ params, body }) => ({
    body: await inventoryService.restock(params.storeId, body),
  }));

  // Passo 5 da saga do checkout: { storeId, lines: [{ sandwichId, name, quantity }] }
  router.post('/api/reservations', async ({ body }) => {
    const { storeId, lines } = (body ?? {}) as { storeId?: unknown; lines?: unknown };
    if (typeof storeId !== 'string' || !Array.isArray(lines)) {
      throw new ValidationError('storeId e lines são obrigatórios');
    }
    return { status: 201, body: await inventoryService.reserve(storeId, lines as ReservationLine[]) };
  });
  // Compensação do passo 5, quando o pagamento é recusado
  router.post('/api/reservations/:id/release', async ({ params }) => ({
    body: { released: await inventoryService.release(Number(params.id)) },
  }));
}
