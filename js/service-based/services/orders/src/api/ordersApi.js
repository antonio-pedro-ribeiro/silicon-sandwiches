// Fachada do serviço Orders: as rotas que a interface (pelo gateway) usa.
export function registerOrdersApi(router, { checkoutService, catalogService, promotionService }) {
  router.get('/stores/:storeId/menu', ({ params }) => ({ body: catalogService.menuFor(params.storeId) }));
  router.post('/checkout', async ({ body }) => ({ status: 201, body: await checkoutService.checkout(body) }));
  router.get('/orders/:id', ({ params }) => ({ body: checkoutService.getOrder(Number(params.id)) }));
  router.get('/promotions', async () => ({ body: await promotionService.list() }));
}
