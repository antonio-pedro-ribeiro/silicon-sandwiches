// Microsserviço Promotion: códigos promocionais e utilizações. Não chama nenhum outro serviço;
// fica a saber das encomendas pelo evento OrderPlaced.
import { openDatabase } from '../../../platform/db.js';
import { createRouter } from '../../../platform/http.js';
import { createPromotionRepository } from './persistence/promotionRepository.js';
import { createPromotionService } from './business/promotionService.js';
import { registerPromotionApi } from './api/promotionApi.js';

export function createApp({ dbPath = ':memory:' } = {}) {
  const db = openDatabase(dbPath, new URL('./persistence/', import.meta.url));
  const service = createPromotionService({ promotionRepository: createPromotionRepository(db) });

  const router = createRouter();
  router.get('/health', () => ({ body: { status: 'ok', service: 'promotion' } }));
  registerPromotionApi(router, service);

  return { handler: router.handle, close: () => db.close() };
}
