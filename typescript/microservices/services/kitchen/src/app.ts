// Microsserviço Kitchen (MakeOrder): a fila de bilhetes de cada loja. Não chama nenhum outro serviço;
// cria os bilhetes quando recebe o evento OrderPlaced.
import { openDatabase } from '../../../platform/db.ts';
import { createRouter } from '../../../platform/http.ts';
import { createKitchenRepository } from './persistence/kitchenRepository.ts';
import { createMakeOrderService } from './business/makeOrderService.ts';
import { registerKitchenApi } from './api/kitchenApi.ts';

export function createApp({ dbPath = ':memory:' }: { dbPath?: string } = {}) {
  const db = openDatabase(dbPath, new URL('./persistence/', import.meta.url));
  const service = createMakeOrderService({ kitchenRepository: createKitchenRepository(db) });

  const router = createRouter();
  router.get('/health', () => ({ body: { status: 'ok', service: 'kitchen' } }));
  registerKitchenApi(router, service);

  return { handler: router.handle, close: () => db.close() };
}
