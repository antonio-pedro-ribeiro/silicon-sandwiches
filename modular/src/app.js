// Raiz de composição: cria os módulos e liga-os pelas APIs públicas.
import { openDatabase } from './shared/db.js';
import { createRouter } from './shared/http.js';
import { registerWebRoutes } from './web/webController.js';

import { createCatalogCheckoutModule } from './modules/catalogcheckout/index.js';
import { createLocationModule } from './modules/location/index.js';
import { createManageInventoryModule } from './modules/manageinventory/index.js';
import { createPromotionModule } from './modules/promotion/index.js';
import { createMakeOrderModule } from './modules/makeorder/index.js';
import { createDeliveryModule } from './modules/delivery/index.js';
import { createRecipesModule } from './modules/recipes/index.js';

export function createApp({ dbPath = ':memory:' } = {}) {
  const db = openDatabase(dbPath);

  const location = createLocationModule({ db });
  const recipes = createRecipesModule({ db });
  const inventory = createManageInventoryModule({ db, recipes: recipes.api });
  const promotion = createPromotionModule({ db });
  const makeOrder = createMakeOrderModule({ db });
  const delivery = createDeliveryModule({ db });
  const catalogCheckout = createCatalogCheckoutModule({
    db,
    location: location.api,
    inventory: inventory.api,
    promotion: promotion.api,
    makeOrder: makeOrder.api,
    delivery: delivery.api,
  });

  const modules = [catalogCheckout, location, inventory, promotion, makeOrder, delivery, recipes];
  const router = createRouter();
  registerWebRoutes(router);
  router.get('/routes', () => ({
    body: { app: 'Silicon Sandwiches', style: 'modular monolith', routes: router.list() },
  }));
  router.get('/health', () => ({
    body: { status: 'ok', style: 'modular monolith', modules: modules.map((m) => m.name) },
  }));
  for (const module of modules) module.registerRoutes(router);

  return {
    handler: router.handle,
    checkout: catalogCheckout.api,
    close: () => db.close(),
  };
}
