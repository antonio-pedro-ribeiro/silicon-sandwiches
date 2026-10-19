// Fachada do serviço Delivery: as entregas.
export function registerDeliveryApi(router, deliveryService) {
  router.get('/deliveries', async () => ({ body: await deliveryService.list() }));
  router.post('/deliveries/:id/advance', async ({ params }) => ({
    body: await deliveryService.advance(Number(params.id)),
  }));
}
