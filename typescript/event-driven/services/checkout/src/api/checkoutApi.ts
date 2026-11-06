// API do serviço Checkout. Todas as rotas são públicas (o gateway encaminha-as).
import type { Router } from '../../../../platform/http.ts';
import type { CatalogService } from '../business/catalogService.ts';
import type { CheckoutService } from '../business/checkoutService.ts';

export function registerCheckoutApi(
  router: Router,
  { checkoutService, catalogService }: { checkoutService: CheckoutService; catalogService: CatalogService },
): void {
  router.get('/stores/:storeId/menu', ({ params }) => ({ body: catalogService.menuFor(params.storeId) }));
  router.post('/checkout', async ({ body }) => ({ status: 201, body: await checkoutService.checkout(body) }));
  router.get('/orders/:id', ({ params }) => ({ body: checkoutService.getOrder(Number(params.id)) }));
}
