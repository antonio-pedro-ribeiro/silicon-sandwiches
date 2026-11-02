// Microsserviço Delivery: zonas (taxa e tempo por loja) e entregas. Não chama nenhum outro serviço;
// agenda as entregas quando recebe o evento OrderPlaced.
import { openDatabase } from '../../../platform/db.js';
import { createRouter } from '../../../platform/http.js';
import { createDeliveryRepository } from './persistence/deliveryRepository.js';
import { createDeliveryService } from './business/deliveryService.js';
import { registerDeliveryApi } from './api/deliveryApi.js';

export function createApp({ dbPath = ':memory:' } = {}) {
  const db = openDatabase(dbPath, new URL('./persistence/', import.meta.url));
  const service = createDeliveryService({ deliveryRepository: createDeliveryRepository(db) });

  const router = createRouter();
  router.get('/health', () => ({ body: { status: 'ok', service: 'delivery' } }));
  registerDeliveryApi(router, service);

  return { handler: router.handle, close: () => db.close() };
}
