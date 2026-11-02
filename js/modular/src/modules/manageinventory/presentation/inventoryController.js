// Rotas de ManageInventory.
export function registerInventoryRoutes(router, inventoryService) {
  router.get('/inventory/:storeId', async ({ params }) => ({
    body: await inventoryService.stockFor(params.storeId),
  }));
  router.post('/inventory/:storeId/restock', async ({ params, body }) => ({
    body: await inventoryService.restock(params.storeId, body),
  }));
}
