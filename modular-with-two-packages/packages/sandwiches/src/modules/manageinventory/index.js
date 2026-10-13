// Módulo ManageInventory · API pública. Depende da API pública de Recipes.
import { migrateModule } from '../../shared/db.js';
import { createStockRepository } from './persistence/stockRepository.js';
import { createInventoryService } from './business/inventoryService.js';
import { registerInventoryRoutes } from './presentation/inventoryController.js';

export function createManageInventoryModule({ db, recipes }) {
  migrateModule(db, new URL('./persistence/', import.meta.url), 'inventory_stock_level');
  const service = createInventoryService({ stockRepository: createStockRepository(db), recipes });
  return {
    name: 'manageinventory',
    api: { reserve: service.reserve, release: service.release },
    registerRoutes: (router) => registerInventoryRoutes(router, service),
  };
}
