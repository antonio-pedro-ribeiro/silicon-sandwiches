// Módulo CatalogCheckout · API pública.
// Recebe as APIs públicas dos módulos de que depende; não importa nada de dentro deles.
import { migrateModule } from '../../shared/db.js';
import { createCatalogRepository } from './persistence/catalogRepository.js';
import { createOrderRepository } from './persistence/orderRepository.js';
import { createCatalogService } from './business/catalogService.js';
import { createCheckoutService } from './business/checkoutService.js';
import { createPaymentService } from './business/paymentService.js';
import { registerCheckoutRoutes } from './presentation/checkoutController.js';

export function createCatalogCheckoutModule({ db, location, inventory, promotion, makeOrder, delivery }) {
  migrateModule(db, new URL('./persistence/', import.meta.url), 'checkout_sandwich');
  const catalogService = createCatalogService({ catalogRepository: createCatalogRepository(db) });
  const checkoutService = createCheckoutService({
    catalog: catalogService,
    orders: createOrderRepository(db),
    payment: createPaymentService(),
    location,
    inventory,
    promotion,
    makeOrder,
    delivery,
  });

  return {
    name: 'catalogcheckout',
    api: {
      checkout: checkoutService.checkout,
      getOrder: checkoutService.getOrder,
      menuFor: catalogService.menuFor,
    },
    registerRoutes: (router) => registerCheckoutRoutes(router, { checkoutService, catalogService }),
  };
}
