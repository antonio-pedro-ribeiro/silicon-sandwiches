// Módulo Delivery (núcleo) · API pública. Recebe o registo de plug-ins (taxas de entrega por loja).
import { migrateModule } from '../../shared/db.js';
import { createDeliveryRepository } from './persistence/deliveryRepository.js';
import { createDeliveryService } from './business/deliveryService.js';
import { registerDeliveryRoutes } from './presentation/deliveryController.js';

export function createDeliveryModule({ db, plugins }) {
  migrateModule(db, new URL('./persistence/', import.meta.url), 'delivery_job');
  const service = createDeliveryService({ deliveryRepository: createDeliveryRepository(db), plugins });
  return {
    name: 'delivery',
    api: { quote: service.quote, schedule: service.schedule },
    registerRoutes: (router) => registerDeliveryRoutes(router, service),
  };
}
