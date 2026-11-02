// Microsserviço Promotion: códigos promocionais e utilizações. Não chama nenhum outro serviço;
// fica a saber das encomendas pelo evento OrderPlaced.
import { openDatabase } from '../../../platform/db.ts';
import { createRouter } from '../../../platform/http.ts';
import { createPromotionRepository } from './persistence/promotionRepository.ts';
import { createPromotionService } from './business/promotionService.ts';
import { registerPromotionApi } from './api/promotionApi.ts';

export function createApp({ dbPath = ':memory:' }: { dbPath?: string } = {}) {
  const db = openDatabase(dbPath, new URL('./persistence/', import.meta.url));
  const service = createPromotionService({ promotionRepository: createPromotionRepository(db) });

  const router = createRouter();
  router.get('/health', () => ({ body: { status: 'ok', service: 'promotion' } }));
  registerPromotionApi(router, service);

  return { handler: router.handle, close: () => db.close() };
}
