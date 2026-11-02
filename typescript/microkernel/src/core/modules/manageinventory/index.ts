// Módulo ManageInventory · API pública. Depende da API pública de Recipes.
import { migrateModule, type Database } from '../../shared/db.ts';
import type { Router } from '../../shared/http.ts';
import { createStockRepository } from './persistence/stockRepository.ts';
import { createInventoryService, type RecipeSource } from './business/inventoryService.ts';
import { registerInventoryRoutes } from './presentation/inventoryController.ts';

export type { Reservation } from './business/inventoryService.ts';
export type ManageInventoryApi = ReturnType<typeof createManageInventoryModule>['api'];

export function createManageInventoryModule({ db, recipes }: { db: Database; recipes: RecipeSource }) {
  migrateModule(db, new URL('./persistence/', import.meta.url), 'inventory_stock_level');
  const service = createInventoryService({ stockRepository: createStockRepository(db), recipes });
  return {
    name: 'manageinventory',
    api: { reserve: service.reserve, release: service.release },
    registerRoutes: (router: Router) => registerInventoryRoutes(router, service),
  };
}
