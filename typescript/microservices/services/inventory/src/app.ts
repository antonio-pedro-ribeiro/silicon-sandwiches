// Microsserviço Inventory (ManageInventory): stock por loja e reservas. Pede as receitas ao serviço Recipes.
import { openDatabase } from '../../../platform/db.ts';
import { createRouter } from '../../../platform/http.ts';
import { createServiceClient } from '../../../platform/serviceClient.ts';
import { createStockRepository } from './persistence/stockRepository.ts';
import { createInventoryService } from './business/inventoryService.ts';
import { registerInventoryApi } from './api/inventoryApi.ts';

export function createApp({ dbPath = ':memory:', services }: { dbPath?: string; services: { recipes: string } }) {
  const db = openDatabase(dbPath, new URL('./persistence/', import.meta.url));
  const recipesClient = createServiceClient({ from: 'inventory', to: 'recipes', baseUrl: services.recipes });
  // A mesma função get(sandwichId) que o módulo Recipes oferecia no monólito modular, agora por HTTP.
  const recipes = {
    get: (sandwichId: string) => recipesClient.get<{ ingredients: { ingredient: string; quantity: number }[] }>(`/recipes/${encodeURIComponent(sandwichId)}`).catch((err: Error) => {
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
