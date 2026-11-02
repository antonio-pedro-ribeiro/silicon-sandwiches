// Módulo CatalogCheckout · API pública.
// Recebe as APIs públicas dos módulos de que depende; não importa nada de dentro deles.
// O que precisa de cada um está descrito em CheckoutDependencies (tipos estruturais).
import { migrateModule, type Database } from '../../shared/db.ts';
import type { Router } from '../../shared/http.ts';
import { createCatalogRepository } from './persistence/catalogRepository.ts';
import { createOrderRepository } from './persistence/orderRepository.ts';
import { createCatalogService } from './business/catalogService.ts';
import { createCheckoutService, type CheckoutDependencies } from './business/checkoutService.ts';
import { createPaymentService } from './business/paymentService.ts';
import { registerCheckoutRoutes } from './presentation/checkoutController.ts';

export type { Order, OrderLine } from './persistence/orderRepository.ts';
export type { MenuItem } from './business/catalogService.ts';

type Dependencies = Pick<CheckoutDependencies, 'location' | 'inventory' | 'promotion' | 'makeOrder' | 'delivery'>;

export type CatalogCheckoutApi = ReturnType<typeof createCatalogCheckoutModule>['api'];

export function createCatalogCheckoutModule({ db, location, inventory, promotion, makeOrder, delivery }: { db: Database } & Dependencies) {
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
    registerRoutes: (router: Router) => registerCheckoutRoutes(router, { checkoutService, catalogService }),
  };
}
