// Rotas de Location.
export function registerLocationRoutes(router, locationService) {
  router.get('/stores', async () => ({ body: await locationService.listStores() }));
  router.post('/stores/:storeId/status', async ({ params, body }) => ({
    body: await locationService.setOpen(params.storeId, body?.open),
  }));
}
