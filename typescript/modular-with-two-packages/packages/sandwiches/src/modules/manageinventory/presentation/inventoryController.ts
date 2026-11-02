// Rotas de ManageInventory.
import type { Router } from '../../../shared/http.ts';
import type { InventoryService } from '../business/inventoryService.ts';

export function registerInventoryRoutes(router: Router, inventoryService: InventoryService): void {
  router.get('/inventory/:storeId', async ({ params }) => ({
    body: await inventoryService.stockFor(params.storeId),
  }));
  router.post('/inventory/:storeId/restock', async ({ params, body }) => ({
    body: await inventoryService.restock(params.storeId, body),
  }));
}
