// Rotas de Promotion.
export function registerPromotionRoutes(router, promotionService) {
  router.get('/promotions', async () => ({ body: await promotionService.list() }));
}
