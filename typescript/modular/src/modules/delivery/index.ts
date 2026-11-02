// Módulo Delivery · API pública.
import { migrateModule, type Database } from '../../shared/db.ts';
import type { Router } from '../../shared/http.ts';
import { createDeliveryRepository } from './persistence/deliveryRepository.ts';
import { createDeliveryService } from './business/deliveryService.ts';
import { registerDeliveryRoutes } from './presentation/deliveryController.ts';

export type { DeliveryQuote } from './business/deliveryService.ts';
export type DeliveryApi = ReturnType<typeof createDeliveryModule>['api'];

export function createDeliveryModule({ db }: { db: Database }) {
  migrateModule(db, new URL('./persistence/', import.meta.url), 'delivery_zone');
  const service = createDeliveryService({ deliveryRepository: createDeliveryRepository(db) });
  return {
    name: 'delivery',
    api: { quote: service.quote, schedule: service.schedule },
    registerRoutes: (router: Router) => registerDeliveryRoutes(router, service),
  };
}
