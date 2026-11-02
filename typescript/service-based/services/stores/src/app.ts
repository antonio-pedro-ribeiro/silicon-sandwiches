// Serviço de domínio Stores (Location + ManageInventory + Recipes): o que o gerente de loja gere.
import { openDatabase } from '../../../libs/platform/db.ts';
import { createRouter } from '../../../libs/platform/http.ts';
import { createStoreRepository } from '../../../libs/common-entities/index.ts';
import { createRecipeRepository, createStockRepository } from '../../../libs/inventory-entities/index.ts';
import { createLocationService } from './business/locationService.ts';
import { createInventoryService } from './business/inventoryService.ts';
import { createRecipeService } from './business/recipeService.ts';
import { registerStoresApi } from './api/storesApi.ts';

export function createApp({ dbPath }: { dbPath: string }) {
  const db = openDatabase(dbPath);
  const locationService = createLocationService({ storeRepository: createStoreRepository(db) });
  const inventoryService = createInventoryService({ stockRepository: createStockRepository(db) });
  const recipeService = createRecipeService({ recipeRepository: createRecipeRepository(db) });

  const router = createRouter();
  router.get('/health', () => ({ body: { status: 'ok', service: 'stores' } }));
  registerStoresApi(router, { locationService, inventoryService, recipeService });

  return { handler: router.handle, close: () => db.close() };
}
