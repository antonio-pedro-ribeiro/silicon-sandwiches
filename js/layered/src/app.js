// Raiz de composição: cria e liga as três camadas. Não pertence a nenhuma delas.
import { openDatabase } from './persistence/db.js';
import { createCatalogRepository } from './persistence/catalogRepository.js';
import { createOrderRepository } from './persistence/orderRepository.js';
import { createStoreRepository } from './persistence/storeRepository.js';
import { createRecipeRepository } from './persistence/recipeRepository.js';
import { createStockRepository } from './persistence/stockRepository.js';
import { createPromotionRepository } from './persistence/promotionRepository.js';
import { createKitchenRepository } from './persistence/kitchenRepository.js';
import { createDeliveryRepository } from './persistence/deliveryRepository.js';

import { createCatalogService } from './business/catalogService.js';
import { createCheckoutService } from './business/checkoutService.js';
import { createLocationService } from './business/locationService.js';
import { createInventoryService } from './business/inventoryService.js';
import { createPromotionService } from './business/promotionService.js';
import { createPaymentService } from './business/paymentService.js';
import { createMakeOrderService } from './business/makeOrderService.js';
import { createDeliveryService } from './business/deliveryService.js';
import { createRecipeService } from './business/recipeService.js';

import { createRouter } from './presentation/http.js';
import { registerCheckoutRoutes } from './presentation/checkoutController.js';
import { registerLocationRoutes } from './presentation/locationController.js';
import { registerInventoryRoutes } from './presentation/inventoryController.js';
import { registerPromotionRoutes } from './presentation/promotionController.js';
import { registerMakeOrderRoutes } from './presentation/makeOrderController.js';
import { registerDeliveryRoutes } from './presentation/deliveryController.js';
import { registerRecipeRoutes } from './presentation/recipeController.js';
import { registerWebRoutes } from './presentation/webController.js';

export function createApp({ dbPath = ':memory:' } = {}) {
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
