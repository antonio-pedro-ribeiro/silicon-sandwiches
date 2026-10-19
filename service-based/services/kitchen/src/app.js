// Serviço de domínio Kitchen (MakeOrder): a fila de bilhetes de cada loja.
import { openDatabase } from '../../../libs/platform/db.js';
import { createRouter } from '../../../libs/platform/http.js';
import { createKitchenRepository } from '../../../libs/kitchen-entities/index.js';
import { createMakeOrderService } from './business/makeOrderService.js';
import { registerKitchenApi } from './api/kitchenApi.js';

export function createApp({ dbPath }) {
  const db = openDatabase(dbPath);
  const service = createMakeOrderService({ kitchenRepository: createKitchenRepository(db) });

  const router = createRouter();
  router.get('/health', () => ({ body: { status: 'ok', service: 'kitchen' } }));
  registerKitchenApi(router, service);

  return { handler: router.handle, close: () => db.close() };
}
