// Serviço de domínio Delivery: as entregas ao domicílio.
import { openDatabase } from '../../../libs/platform/db.ts';
import { createRouter } from '../../../libs/platform/http.ts';
import { createDeliveryRepository } from '../../../libs/delivery-entities/index.ts';
import { createDeliveryService } from './business/deliveryService.ts';
import { registerDeliveryApi } from './api/deliveryApi.ts';

export function createApp({ dbPath }: { dbPath: string }) {
  const db = openDatabase(dbPath);
  const service = createDeliveryService({ deliveryRepository: createDeliveryRepository(db) });

  const router = createRouter();
  router.get('/health', () => ({ body: { status: 'ok', service: 'delivery' } }));
  registerDeliveryApi(router, service);

  return { handler: router.handle, close: () => db.close() };
}
