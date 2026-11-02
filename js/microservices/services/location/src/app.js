// Microsserviço Location: as lojas e se estão abertas. Não depende de nenhum outro serviço.
import { openDatabase } from '../../../platform/db.js';
import { createRouter } from '../../../platform/http.js';
import { createStoreRepository } from './persistence/storeRepository.js';
import { createLocationService } from './business/locationService.js';
import { registerLocationApi } from './api/locationApi.js';

export function createApp({ dbPath = ':memory:' } = {}) {
  const db = openDatabase(dbPath, new URL('./persistence/', import.meta.url));
  const service = createLocationService({ storeRepository: createStoreRepository(db) });

  const router = createRouter();
  router.get('/health', () => ({ body: { status: 'ok', service: 'location' } }));
  registerLocationApi(router, service);

  return { handler: router.handle, close: () => db.close() };
}
