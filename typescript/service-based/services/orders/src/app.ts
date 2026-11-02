// Serviço de domínio Orders (CatalogCheckout + Promotion): menu, checkout, encomendas e códigos.
// Por dentro é uma pequena arquitetura em camadas: api/ → business/ → bibliotecas de entidades.
// Usa as cinco bibliotecas de entidades, porque o checkout mexe em todas as partições da base de dados.
import { openDatabase } from '../../../libs/platform/db.ts';
import { createRouter } from '../../../libs/platform/http.ts';
import { createStoreRepository } from '../../../libs/common-entities/index.ts';
import {
  createCatalogRepository, createOrderRepository, createPromotionRepository,
} from '../../../libs/orders-entities/index.ts';
import { createRecipeRepository, createStockRepository } from '../../../libs/inventory-entities/index.ts';
import { createKitchenRepository } from '../../../libs/kitchen-entities/index.ts';
import { createDeliveryRepository } from '../../../libs/delivery-entities/index.ts';
import { createCatalogService } from './business/catalogService.ts';
import { createCheckoutService } from './business/checkoutService.ts';
import { createPaymentService } from './business/paymentService.ts';
import { createPromotionService } from './business/promotionService.ts';
import { registerOrdersApi } from './api/ordersApi.ts';

export function createApp({ dbPath }: { dbPath: string }) {
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
