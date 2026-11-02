// Fachada do serviço Stores: lojas, stock e receitas.
import type { Router } from '../../../../libs/platform/http.ts';
import type { InventoryService } from '../business/inventoryService.ts';
import type { LocationService } from '../business/locationService.ts';
import type { RecipeService } from '../business/recipeService.ts';

export function registerStoresApi(
  router: Router,
  { locationService, inventoryService, recipeService }:
    { locationService: LocationService; inventoryService: InventoryService; recipeService: RecipeService },
): void {
  router.get('/stores', async () => ({ body: await locationService.listStores() }));
  router.post('/stores/:storeId/status', async ({ params, body }) => ({
    body: await locationService.setOpen(params.storeId, (body as { open?: unknown } | undefined)?.open),
  }));
  router.get('/inventory/:storeId', async ({ params }) => ({ body: await inventoryService.stockFor(params.storeId) }));
  router.post('/inventory/:storeId/restock', async ({ params, body }) => ({
    body: await inventoryService.restock(params.storeId, body),
  }));
  router.get('/recipes/:sandwichId', async ({ params }) => {
    const recipe = await recipeService.get(params.sandwichId);
    return recipe ? { body: recipe } : { status: 404, body: { error: 'Receita não encontrada' } };
  });
}
