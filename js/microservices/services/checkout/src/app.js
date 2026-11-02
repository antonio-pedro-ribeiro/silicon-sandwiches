// Microsserviço Checkout (CatalogCheckout): catálogo, menus locais, encomendas e a saga do checkout.
// Tem a sua base de dados; fala com Location, Promotion, Delivery e Inventory por HTTP e publica
// OrderPlaced para os subscritores.
import { openDatabase } from '../../../platform/db.js';
import { createRouter } from '../../../platform/http.js';
import { createCatalogRepository } from './persistence/catalogRepository.js';
import { createOrderRepository } from './persistence/orderRepository.js';
import { createOutboxRepository } from './persistence/outboxRepository.js';
import { createCatalogService } from './business/catalogService.js';
import { createCheckoutService } from './business/checkoutService.js';
import { createEventPublisher } from './business/eventPublisher.js';
import { createPaymentService } from './business/paymentService.js';
import { createClients } from './clients.js';
import { registerCheckoutApi } from './api/checkoutApi.js';

// services: { location, promotion, delivery, inventory } → URL de cada um
// subscribers: { nome: URL } dos serviços que recebem OrderPlaced
export function createApp({ dbPath = ':memory:', services, subscribers }) {
  const db = openDatabase(dbPath, new URL('./persistence/', import.meta.url));
  const outbox = createOutboxRepository(db);
  const events = createEventPublisher({ outbox, subscribers });
  const catalogService = createCatalogService({ catalogRepository: createCatalogRepository(db) });
  const checkoutService = createCheckoutService({
    catalog: catalogService,
    orders: createOrderRepository(db),
    outbox,
    events,
    payment: createPaymentService(),
    ...createClients(services),
  });

  const router = createRouter();
  router.get('/health', () => ({ body: { status: 'ok', service: 'checkout' } }));
  registerCheckoutApi(router, { checkoutService, catalogService });

  return {
    handler: router.handle,
    checkout: { checkout: checkoutService.checkout, getOrder: checkoutService.getOrder, menuFor: catalogService.menuFor },
    events,
    close: () => {
      events.stop();
      db.close();
    },
  };
}
