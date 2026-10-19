// Serviço de domínio Stores (Location + ManageInventory + Recipes): o que o gerente de loja gere.
import { openDatabase } from '../../../libs/platform/db.js';
import { createRouter } from '../../../libs/platform/http.js';
import { createStoreRepository } from '../../../libs/common-entities/index.js';
import { createRecipeRepository, createStockRepository } from '../../../libs/inventory-entities/index.js';
import { createLocationService } from './business/locationService.js';
import { createInventoryService } from './business/inventoryService.js';
import { createRecipeService } from './business/recipeService.js';
import { registerStoresApi } from './api/storesApi.js';

export function createApp({ dbPath }) {
  const db = openDatabase(dbPath);
  const locationService = createLocationService({ storeRepository: createStoreRepository(db) });
  const inventoryService = createInventoryService({ stockRepository: createStockRepository(db) });
  const recipeService = createRecipeService({ recipeRepository: createRecipeRepository(db) });

  const router = createRouter();
  router.get('/health', () => ({ body: { status: 'ok', service: 'stores' } }));
  registerStoresApi(router, { locationService, inventoryService, recipeService });

  return { handler: router.handle, close: () => db.close() };
}
