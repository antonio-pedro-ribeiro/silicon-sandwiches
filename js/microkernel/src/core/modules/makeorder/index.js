// Módulo MakeOrder · API pública.
import { migrateModule } from '../../shared/db.js';
import { createKitchenRepository } from './persistence/kitchenRepository.js';
import { createMakeOrderService } from './business/makeOrderService.js';
import { registerMakeOrderRoutes } from './presentation/makeOrderController.js';

export function createMakeOrderModule({ db }) {
  migrateModule(db, new URL('./persistence/', import.meta.url), 'kitchen_ticket');
  const service = createMakeOrderService({ kitchenRepository: createKitchenRepository(db) });
  return {
    name: 'makeorder',
    api: { enqueue: service.enqueue },
    registerRoutes: (router) => registerMakeOrderRoutes(router, service),
  };
}
