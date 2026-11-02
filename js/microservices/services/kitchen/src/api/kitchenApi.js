// API do serviço Kitchen. /kitchen/… é pública; /events/order-placed recebe o evento OrderPlaced.
export function registerKitchenApi(router, makeOrderService) {
  router.get('/kitchen/queue', async ({ query }) => ({ body: await makeOrderService.getQueue(query.get('storeId')) }));
  router.post('/kitchen/tickets/:id/advance', async ({ params }) => ({
    body: await makeOrderService.advance(Number(params.id)),
  }));

  router.post('/events/order-placed', async ({ body: event }) => ({
    body: await makeOrderService.enqueue({ orderId: event.orderId, storeId: event.storeId, items: event.items }),
  }));
}
