// Rotas do CatalogCheckout (implementado).
import type { Router } from './http.ts';
import type { CatalogService } from '../business/catalogService.ts';
import type { CheckoutService } from '../business/checkoutService.ts';

export function registerCheckoutRoutes(
  router: Router,
  { checkoutService, catalogService }: { checkoutService: CheckoutService; catalogService: CatalogService },
): void {
  router.get('/stores/:storeId/menu', ({ params }) => ({
    body: catalogService.menuFor(params.storeId),
  }));

  router.post('/checkout', async ({ body }) => ({
    status: 201,
    body: await checkoutService.checkout(body),
  }));

  router.get('/orders/:id', ({ params }) => ({
    body: checkoutService.getOrder(Number(params.id)),
  }));
}
