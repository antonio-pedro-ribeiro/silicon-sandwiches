// Módulo Promotion · API pública.
import { migrateModule, type Database } from '../../shared/db.ts';
import type { Router } from '../../shared/http.ts';
import { createPromotionRepository } from './persistence/promotionRepository.ts';
import { createPromotionService } from './business/promotionService.ts';
import { registerPromotionRoutes } from './presentation/promotionController.ts';

export type { Discount } from './business/promotionService.ts';
export type PromotionApi = ReturnType<typeof createPromotionModule>['api'];

export function createPromotionModule({ db }: { db: Database }) {
  migrateModule(db, new URL('./persistence/', import.meta.url), 'promotion_code');
  const service = createPromotionService({ promotionRepository: createPromotionRepository(db) });
  return {
    name: 'promotion',
    api: { discountFor: service.discountFor, redeem: service.redeem },
    registerRoutes: (router: Router) => registerPromotionRoutes(router, service),
  };
}
