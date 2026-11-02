// Microsserviço Location: as lojas e se estão abertas. Não depende de nenhum outro serviço.
import { openDatabase } from '../../../platform/db.ts';
import { createRouter } from '../../../platform/http.ts';
import { createStoreRepository } from './persistence/storeRepository.ts';
import { createLocationService } from './business/locationService.ts';
import { registerLocationApi } from './api/locationApi.ts';

export function createApp({ dbPath = ':memory:' }: { dbPath?: string } = {}) {
  const db = openDatabase(dbPath, new URL('./persistence/', import.meta.url));
  const service = createLocationService({ storeRepository: createStoreRepository(db) });

  const router = createRouter();
  router.get('/health', () => ({ body: { status: 'ok', service: 'location' } }));
  registerLocationApi(router, service);

  return { handler: router.handle, close: () => db.close() };
}
