// Módulo Location · API pública.
import { migrateModule } from '../../shared/db.js';
import { createStoreRepository } from './persistence/storeRepository.js';
import { createLocationService } from './business/locationService.js';
import { registerLocationRoutes } from './presentation/locationController.js';

export function createLocationModule({ db }) {
  migrateModule(db, new URL('./persistence/', import.meta.url), 'location_store');
  const service = createLocationService({ storeRepository: createStoreRepository(db) });
  return {
    name: 'location',
    api: { getStore: service.getStore },
    registerRoutes: (router) => registerLocationRoutes(router, service),
  };
}
