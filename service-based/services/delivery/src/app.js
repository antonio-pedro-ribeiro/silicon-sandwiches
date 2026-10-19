// Serviço de domínio Delivery: as entregas ao domicílio.
import { openDatabase } from '../../../libs/platform/db.js';
import { createRouter } from '../../../libs/platform/http.js';
import { createDeliveryRepository } from '../../../libs/delivery-entities/index.js';
import { createDeliveryService } from './business/deliveryService.js';
import { registerDeliveryApi } from './api/deliveryApi.js';

export function createApp({ dbPath }) {
  const db = openDatabase(dbPath);
  const service = createDeliveryService({ deliveryRepository: createDeliveryRepository(db) });

  const router = createRouter();
  router.get('/health', () => ({ body: { status: 'ok', service: 'delivery' } }));
  registerDeliveryApi(router, service);

  return { handler: router.handle, close: () => db.close() };
}
