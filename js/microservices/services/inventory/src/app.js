// Microsserviço Inventory (ManageInventory): stock por loja e reservas. Pede as receitas ao serviço Recipes.
import { openDatabase } from '../../../platform/db.js';
import { createRouter } from '../../../platform/http.js';
import { createServiceClient } from '../../../platform/serviceClient.js';
import { createStockRepository } from './persistence/stockRepository.js';
import { createInventoryService } from './business/inventoryService.js';
import { registerInventoryApi } from './api/inventoryApi.js';

export function createApp({ dbPath = ':memory:', services }) {
  const db = openDatabase(dbPath, new URL('./persistence/', import.meta.url));
  const recipesClient = createServiceClient({ from: 'inventory', to: 'recipes', baseUrl: services.recipes });
  // A mesma função get(sandwichId) que o módulo Recipes oferecia no monólito modular, agora por HTTP.
  const recipes = {
    get: (sandwichId) => recipesClient.get(`/recipes/${encodeURIComponent(sandwichId)}`).catch((err) => {
      if (err.name === 'NotFoundError') return undefined;
      throw err;
    }),
  };
  const service = createInventoryService({ stockRepository: createStockRepository(db), recipes });

  const router = createRouter();
  router.get('/health', () => ({ body: { status: 'ok', service: 'inventory' } }));
  registerInventoryApi(router, service);

  return { handler: router.handle, close: () => db.close() };
}
