// Rotas do CatalogCheckout (implementado).
export function registerCheckoutRoutes(router, { checkoutService, catalogService }) {
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
