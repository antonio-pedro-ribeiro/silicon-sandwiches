// Serviço de domínio Orders (CatalogCheckout + Promotion): menu, checkout, encomendas e códigos.
// Por dentro é uma pequena arquitetura em camadas: api/ → business/ → bibliotecas de entidades.
// Usa as cinco bibliotecas de entidades, porque o checkout mexe em todas as partições da base de dados.
import { openDatabase } from '../../../libs/platform/db.js';
import { createRouter } from '../../../libs/platform/http.js';
import { createStoreRepository } from '../../../libs/common-entities/index.js';
import {
  createCatalogRepository, createOrderRepository, createPromotionRepository,
} from '../../../libs/orders-entities/index.js';
import { createRecipeRepository, createStockRepository } from '../../../libs/inventory-entities/index.js';
import { createKitchenRepository } from '../../../libs/kitchen-entities/index.js';
import { createDeliveryRepository } from '../../../libs/delivery-entities/index.js';
import { createCatalogService } from './business/catalogService.js';
import { createCheckoutService } from './business/checkoutService.js';
import { createPaymentService } from './business/paymentService.js';
import { createPromotionService } from './business/promotionService.js';
import { registerOrdersApi } from './api/ordersApi.js';

export function createApp({ dbPath }) {
  const db = openDatabase(dbPath);
  const entities = {
    stores: createStoreRepository(db),
    orders: createOrderRepository(db),
    promotions: createPromotionRepository(db),
    stock: createStockRepository(db),
    recipes: createRecipeRepository(db),
    kitchen: createKitchenRepository(db),
    deliveries: createDeliveryRepository(db),
  };
  const catalogService = createCatalogService({ catalogRepository: createCatalogRepository(db) });
  const promotionService = createPromotionService({ promotionRepository: entities.promotions });
  const checkoutService = createCheckoutService({
    db, catalog: catalogService, promotion: promotionService, payment: createPaymentService(), entities,
  });

  const router = createRouter();
  router.get('/health', () => ({ body: { status: 'ok', service: 'orders' } }));
  registerOrdersApi(router, { checkoutService, catalogService, promotionService });

  return {
    handler: router.handle,
    checkout: { checkout: checkoutService.checkout, getOrder: checkoutService.getOrder, menuFor: catalogService.menuFor },
    close: () => db.close(),
  };
}
