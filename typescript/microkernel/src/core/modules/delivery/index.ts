// Módulo Delivery (núcleo) · API pública. Recebe o registo de plug-ins (taxas de entrega por loja).
import { migrateModule, type Database } from '../../shared/db.ts';
import type { Router } from '../../shared/http.ts';
import type { PluginHost } from '../../plugins/pluginHost.ts';
import { createDeliveryRepository } from './persistence/deliveryRepository.ts';
import { createDeliveryService } from './business/deliveryService.ts';
import { registerDeliveryRoutes } from './presentation/deliveryController.ts';

export type { DeliveryQuote } from './business/deliveryService.ts';
export type DeliveryApi = ReturnType<typeof createDeliveryModule>['api'];

export function createDeliveryModule({ db, plugins }: { db: Database; plugins: PluginHost }) {
  migrateModule(db, new URL('./persistence/', import.meta.url), 'delivery_job');
  const service = createDeliveryService({ deliveryRepository: createDeliveryRepository(db), plugins });
  return {
    name: 'delivery',
    api: { quote: service.quote, schedule: service.schedule },
    registerRoutes: (router: Router) => registerDeliveryRoutes(router, service),
  };
}
