// Módulo Promotion (núcleo) · API pública. Recebe o registo de plug-ins (um por código).
import { migrateModule, type Database } from '../../shared/db.ts';
import type { Router } from '../../shared/http.ts';
import type { PluginHost } from '../../plugins/pluginHost.ts';
import { createPromotionRepository } from './persistence/promotionRepository.ts';
import { createPromotionService } from './business/promotionService.ts';
import { registerPromotionRoutes } from './presentation/promotionController.ts';

export type { Discount } from './business/promotionService.ts';
export type PromotionApi = ReturnType<typeof createPromotionModule>['api'];

export function createPromotionModule({ db, plugins }: { db: Database; plugins: PluginHost }) {
  migrateModule(db, new URL('./persistence/', import.meta.url), 'promotion_redemption');
  const service = createPromotionService({ promotionRepository: createPromotionRepository(db), plugins });
  return {
    name: 'promotion',
    api: { discountFor: service.discountFor, redeem: service.redeem },
    registerRoutes: (router: Router) => registerPromotionRoutes(router, service),
  };
}
