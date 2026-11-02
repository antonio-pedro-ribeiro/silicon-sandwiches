// Fachada do serviço Orders: as rotas que a interface (pelo gateway) usa.
import type { Router } from '../../../../libs/platform/http.ts';
import type { CatalogService } from '../business/catalogService.ts';
import type { CheckoutService } from '../business/checkoutService.ts';
import type { PromotionService } from '../business/promotionService.ts';

export function registerOrdersApi(
  router: Router,
  { checkoutService, catalogService, promotionService }:
    { checkoutService: CheckoutService; catalogService: CatalogService; promotionService: PromotionService },
): void {
  router.get('/stores/:storeId/menu', ({ params }) => ({ body: catalogService.menuFor(params.storeId) }));
  router.post('/checkout', async ({ body }) => ({ status: 201, body: await checkoutService.checkout(body) }));
  router.get('/orders/:id', ({ params }) => ({ body: checkoutService.getOrder(Number(params.id)) }));
  router.get('/promotions', async () => ({ body: await promotionService.list() }));
}
