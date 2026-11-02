// Raiz de composição: cria os módulos e liga-os pelas APIs públicas.
// O Delivery é o único módulo remoto: chega por HTTP, vindo do outro pacote de deployment.
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

export function createApp(
  { dbPath = ':memory:', deliveryUrl = 'http://localhost:3004' }: { dbPath?: string; deliveryUrl?: string } = {},
) {
  const db = openDatabase(dbPath);

  const location = createLocationModule({ db });
  const recipes = createRecipesModule({ db });
  const inventory = createManageInventoryModule({ db, recipes: recipes.api });
  const promotion = createPromotionModule({ db });
  const makeOrder = createMakeOrderModule({ db });
  const delivery = createDeliveryModule({ baseUrl: deliveryUrl });
  const catalogCheckout = createCatalogCheckoutModule({
    db,
    location: location.api,
    inventory: inventory.api,
    promotion: promotion.api,
    makeOrder: makeOrder.api,
    delivery: delivery.api,
  });

  const modules = [catalogCheckout, location, inventory, promotion, makeOrder, recipes];
  const router = createRouter();
  registerWebRoutes(router);
  router.get('/routes', () => ({
    body: { app: 'Silicon Sandwiches', style: 'modular deployment', routes: router.list() },
  }));
  router.get('/health', () => ({
    body: {
      status: 'ok',
      style: 'modular deployment',
      deployment: 'sandwiches',
      modules: modules.map((m) => m.name),
      remote: { [delivery.name]: delivery.remote },
    },
  }));
  for (const module of [...modules, delivery]) module.registerRoutes(router);

  return {
    handler: router.handle,
    checkout: catalogCheckout.api,
    close: () => db.close(),
  };
}
