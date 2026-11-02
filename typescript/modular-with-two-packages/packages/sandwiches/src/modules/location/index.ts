// Módulo Location · API pública.
import { migrateModule, type Database } from '../../shared/db.ts';
import type { Router } from '../../shared/http.ts';
import { createStoreRepository } from './persistence/storeRepository.ts';
import { createLocationService } from './business/locationService.ts';
import { registerLocationRoutes } from './presentation/locationController.ts';

export type { Store } from './persistence/storeRepository.ts';
export type LocationApi = ReturnType<typeof createLocationModule>['api'];

export function createLocationModule({ db }: { db: Database }) {
  migrateModule(db, new URL('./persistence/', import.meta.url), 'location_store');
  const service = createLocationService({ storeRepository: createStoreRepository(db) });
  return {
    name: 'location',
    api: { getStore: service.getStore },
    registerRoutes: (router: Router) => registerLocationRoutes(router, service),
  };
}
