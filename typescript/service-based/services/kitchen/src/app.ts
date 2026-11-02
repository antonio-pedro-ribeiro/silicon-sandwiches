// Serviço de domínio Kitchen (MakeOrder): a fila de bilhetes de cada loja.
import { openDatabase } from '../../../libs/platform/db.ts';
import { createRouter } from '../../../libs/platform/http.ts';
import { createKitchenRepository } from '../../../libs/kitchen-entities/index.ts';
import { createMakeOrderService } from './business/makeOrderService.ts';
import { registerKitchenApi } from './api/kitchenApi.ts';

export function createApp({ dbPath }: { dbPath: string }) {
  const db = openDatabase(dbPath);
  const service = createMakeOrderService({ kitchenRepository: createKitchenRepository(db) });

  const router = createRouter();
  router.get('/health', () => ({ body: { status: 'ok', service: 'kitchen' } }));
  registerKitchenApi(router, service);

  return { handler: router.handle, close: () => db.close() };
}
