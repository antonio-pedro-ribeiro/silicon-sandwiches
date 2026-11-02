// Raiz de composição: cria os módulos e liga-os pelas APIs públicas.
import { openDatabase } from './shared/db.ts';
import { createRouter } from './shared/http.ts';
import { registerWebRoutes } from './web/webController.ts';

import { createCatalogCheckoutModule } from './modules/catalogcheckout/index.ts';
import { createLocationModule } from './modules/location/index.ts';
import { createManageInventoryModule } from './modules/manageinventory/index.ts';
import { createPromotionModule } from './modules/promotion/index.ts';
import { createMakeOrderModule } from './modules/makeorder/index.ts';
import { createDeliveryModule } from './modules/delivery/index.ts';
import { createRecipesModule } from './modules/recipes/index.ts';

export function createApp({ dbPath = ':memory:' }: { dbPath?: string } = {}) {
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
