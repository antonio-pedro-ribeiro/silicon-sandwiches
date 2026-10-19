// Módulo Promotion (núcleo) · API pública. Recebe o registo de plug-ins (um por código).
import { migrateModule } from '../../shared/db.js';
import { createPromotionRepository } from './persistence/promotionRepository.js';
import { createPromotionService } from './business/promotionService.js';
import { registerPromotionRoutes } from './presentation/promotionController.js';

export function createPromotionModule({ db, plugins }) {
  migrateModule(db, new URL('./persistence/', import.meta.url), 'promotion_redemption');
  const service = createPromotionService({ promotionRepository: createPromotionRepository(db), plugins });
  return {
    name: 'promotion',
    api: { discountFor: service.discountFor, redeem: service.redeem },
    registerRoutes: (router) => registerPromotionRoutes(router, service),
  };
}
