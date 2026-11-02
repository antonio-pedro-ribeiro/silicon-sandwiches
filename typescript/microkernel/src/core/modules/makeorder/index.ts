// Módulo MakeOrder · API pública.
import { migrateModule, type Database } from '../../shared/db.ts';
import type { Router } from '../../shared/http.ts';
import { createKitchenRepository } from './persistence/kitchenRepository.ts';
import { createMakeOrderService } from './business/makeOrderService.ts';
import { registerMakeOrderRoutes } from './presentation/makeOrderController.ts';

export type { KitchenTicket } from './persistence/kitchenRepository.ts';
export type MakeOrderApi = ReturnType<typeof createMakeOrderModule>['api'];

export function createMakeOrderModule({ db }: { db: Database }) {
  migrateModule(db, new URL('./persistence/', import.meta.url), 'kitchen_ticket');
  const service = createMakeOrderService({ kitchenRepository: createKitchenRepository(db) });
  return {
    name: 'makeorder',
    api: { enqueue: service.enqueue },
    registerRoutes: (router: Router) => registerMakeOrderRoutes(router, service),
  };
}
