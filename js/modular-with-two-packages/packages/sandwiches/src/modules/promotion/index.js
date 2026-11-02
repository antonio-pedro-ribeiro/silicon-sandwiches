// Módulo Promotion · API pública.
import { migrateModule } from '../../shared/db.js';
import { createPromotionRepository } from './persistence/promotionRepository.js';
import { createPromotionService } from './business/promotionService.js';
import { registerPromotionRoutes } from './presentation/promotionController.js';

export function createPromotionModule({ db }) {
  migrateModule(db, new URL('./persistence/', import.meta.url), 'promotion_code');
  const service = createPromotionService({ promotionRepository: createPromotionRepository(db) });
  return {
    name: 'promotion',
    api: { discountFor: service.discountFor, redeem: service.redeem },
    registerRoutes: (router) => registerPromotionRoutes(router, service),
  };
}
