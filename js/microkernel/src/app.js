// Raiz de composição: cria o registo de plug-ins, os módulos do núcleo e liga-os.
// É o único ficheiro que conhece o núcleo (core/) e os plug-ins (plugins/).
import { openDatabase } from './core/shared/db.js';
import { createRouter } from './core/shared/http.js';
import { registerWebRoutes } from './core/web/webController.js';
import { createPluginHost } from './core/plugins/pluginHost.js';
import { plugins as registeredPlugins } from './plugins/registry.js';

import { createCatalogCheckoutModule } from './core/modules/catalogcheckout/index.js';
import { createLocationModule } from './core/modules/location/index.js';
import { createManageInventoryModule } from './core/modules/manageinventory/index.js';
import { createPromotionModule } from './core/modules/promotion/index.js';
import { createMakeOrderModule } from './core/modules/makeorder/index.js';
import { createDeliveryModule } from './core/modules/delivery/index.js';
import { createRecipesModule } from './core/modules/recipes/index.js';

// plugins: por omissão, os do registo; os testes podem passar outros (ou nenhum).
export function createApp({ dbPath = ':memory:', plugins = registeredPlugins } = {}) {
  const host = createPluginHost(plugins);
  const db = openDatabase(dbPath);

  const location = createLocationModule({ db });
  const recipes = createRecipesModule({ db });
  const inventory = createManageInventoryModule({ db, recipes: recipes.api });
  const promotion = createPromotionModule({ db, plugins: host });
  const makeOrder = createMakeOrderModule({ db });
  const delivery = createDeliveryModule({ db, plugins: host });
  const catalogCheckout = createCatalogCheckoutModule({
    db,
    plugins: host,
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
    body: { app: 'Silicon Sandwiches', style: 'microkernel', routes: router.list() },
  }));
  router.get('/health', () => ({
    body: {
      status: 'ok',
      style: 'microkernel',
      core: modules.map((m) => m.name),
      plugins: host.list().map((p) => p.name),
    },
  }));
  router.get('/plugins', () => ({ body: host.list() }));
  for (const module of modules) module.registerRoutes(router);

  return {
    handler: router.handle,
    checkout: catalogCheckout.api,
    close: () => db.close(),
  };
}
