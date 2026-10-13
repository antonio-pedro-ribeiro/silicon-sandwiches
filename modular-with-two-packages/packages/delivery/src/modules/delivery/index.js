// Módulo Delivery · API pública.
import { migrateModule } from '../../shared/db.js';
import { createDeliveryRepository } from './persistence/deliveryRepository.js';
import { createDeliveryService } from './business/deliveryService.js';
import { registerDeliveryRoutes } from './presentation/deliveryController.js';

export function createDeliveryModule({ db }) {
  migrateModule(db, new URL('./persistence/', import.meta.url), 'delivery_zone');
  const service = createDeliveryService({ deliveryRepository: createDeliveryRepository(db) });
  return {
    name: 'delivery',
    api: { quote: service.quote, schedule: service.schedule },
    registerRoutes: (router) => registerDeliveryRoutes(router, service),
  };
}
