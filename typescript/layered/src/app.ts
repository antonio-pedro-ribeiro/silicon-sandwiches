// Raiz de composição: cria e liga as três camadas. Não pertence a nenhuma delas.
import { openDatabase } from './persistence/db.ts';
import { createCatalogRepository } from './persistence/catalogRepository.ts';
import { createOrderRepository } from './persistence/orderRepository.ts';
import { createStoreRepository } from './persistence/storeRepository.ts';
import { createRecipeRepository } from './persistence/recipeRepository.ts';
import { createStockRepository } from './persistence/stockRepository.ts';
import { createPromotionRepository } from './persistence/promotionRepository.ts';
import { createKitchenRepository } from './persistence/kitchenRepository.ts';
import { createDeliveryRepository } from './persistence/deliveryRepository.ts';

import { createCatalogService } from './business/catalogService.ts';
import { createCheckoutService } from './business/checkoutService.ts';
import { createLocationService } from './business/locationService.ts';
import { createInventoryService } from './business/inventoryService.ts';
import { createPromotionService } from './business/promotionService.ts';
import { createPaymentService } from './business/paymentService.ts';
import { createMakeOrderService } from './business/makeOrderService.ts';
import { createDeliveryService } from './business/deliveryService.ts';
import { createRecipeService } from './business/recipeService.ts';

import { createRouter } from './presentation/http.ts';
import { registerCheckoutRoutes } from './presentation/checkoutController.ts';
import { registerLocationRoutes } from './presentation/locationController.ts';
import { registerInventoryRoutes } from './presentation/inventoryController.ts';
import { registerPromotionRoutes } from './presentation/promotionController.ts';
import { registerMakeOrderRoutes } from './presentation/makeOrderController.ts';
import { registerDeliveryRoutes } from './presentation/deliveryController.ts';
import { registerRecipeRoutes } from './presentation/recipeController.ts';
import { registerWebRoutes } from './presentation/webController.ts';

export function createApp({ dbPath = ':memory:' }: { dbPath?: string } = {}) {
  // Persistência
  const db = openDatabase(dbPath);
  const catalogRepository = createCatalogRepository(db);
  const orderRepository = createOrderRepository(db);
  const storeRepository = createStoreRepository(db);
  const recipeRepository = createRecipeRepository(db);
  const stockRepository = createStockRepository(db);
  const promotionRepository = createPromotionRepository(db);
  const kitchenRepository = createKitchenRepository(db);
  const deliveryRepository = createDeliveryRepository(db);

  // Negócio
  const catalogService = createCatalogService({ catalogRepository });
  const locationService = createLocationService({ storeRepository });
  const recipeService = createRecipeService({ recipeRepository });
  const inventoryService = createInventoryService({ stockRepository, recipes: recipeService });
  const promotionService = createPromotionService({ promotionRepository });
  const paymentService = createPaymentService();
  const makeOrderService = createMakeOrderService({ kitchenRepository });
  const deliveryService = createDeliveryService({ deliveryRepository });
  const checkoutService = createCheckoutService({
    catalog: catalogService,
    orders: orderRepository,
    payment: paymentService,
    location: locationService,
    inventory: inventoryService,
    promotion: promotionService,
    makeOrder: makeOrderService,
    delivery: deliveryService,
  });

  // Apresentação
  const router = createRouter();
  registerWebRoutes(router);
  router.get('/routes', () => ({
    body: { app: 'Silicon Sandwiches', style: 'layered', routes: router.list() },
  }));
  router.get('/health', () => ({
    body: { status: 'ok', style: 'layered', layers: ['presentation', 'business', 'persistence', 'database'] },
  }));
  registerCheckoutRoutes(router, { checkoutService, catalogService });
  registerLocationRoutes(router, locationService);
  registerInventoryRoutes(router, inventoryService);
  registerPromotionRoutes(router, promotionService);
  registerMakeOrderRoutes(router, makeOrderService);
  registerDeliveryRoutes(router, deliveryService);
  registerRecipeRoutes(router, recipeService);

  return {
    handler: router.handle,
    checkout: {
      checkout: checkoutService.checkout,
      getOrder: checkoutService.getOrder,
      menuFor: catalogService.menuFor,
    },
    close: () => db.close(),
  };
}
