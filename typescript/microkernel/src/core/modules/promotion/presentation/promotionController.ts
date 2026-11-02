// Rotas de Promotion.
import type { Router } from '../../../shared/http.ts';
import type { PromotionService } from '../business/promotionService.ts';

export function registerPromotionRoutes(router: Router, promotionService: PromotionService): void {
  router.get('/promotions', async () => ({ body: await promotionService.list() }));
}
