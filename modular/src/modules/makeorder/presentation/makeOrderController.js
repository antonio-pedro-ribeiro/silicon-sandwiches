// Rotas de MakeOrder.
export function registerMakeOrderRoutes(router, makeOrderService) {
  router.get('/kitchen/queue', async ({ query }) => ({
    body: await makeOrderService.getQueue(query.get('storeId')),
  }));
  router.post('/kitchen/tickets/:id/advance', async ({ params }) => ({
    body: await makeOrderService.advance(Number(params.id)),
  }));
}
