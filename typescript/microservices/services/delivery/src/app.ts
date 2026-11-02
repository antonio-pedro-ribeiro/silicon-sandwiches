// Microsserviço Delivery: zonas (taxa e tempo por loja) e entregas. Não chama nenhum outro serviço;
// agenda as entregas quando recebe o evento OrderPlaced.
import { openDatabase } from '../../../platform/db.ts';
import { createRouter } from '../../../platform/http.ts';
import { createDeliveryRepository } from './persistence/deliveryRepository.ts';
import { createDeliveryService } from './business/deliveryService.ts';
import { registerDeliveryApi } from './api/deliveryApi.ts';

export function createApp({ dbPath = ':memory:' }: { dbPath?: string } = {}) {
  const db = openDatabase(dbPath, new URL('./persistence/', import.meta.url));
  const service = createDeliveryService({ deliveryRepository: createDeliveryRepository(db) });

  const router = createRouter();
  router.get('/health', () => ({ body: { status: 'ok', service: 'delivery' } }));
  registerDeliveryApi(router, service);

  return { handler: router.handle, close: () => db.close() };
}
