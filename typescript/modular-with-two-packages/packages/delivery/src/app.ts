// Raiz de composição do pacote Delivery: um só módulo, publicado por HTTP.
// O módulo (modules/delivery/) é exatamente o mesmo do monólito modular: só mudou de pacote.
import { openDatabase } from './shared/db.ts';
import { createRouter } from './shared/http.ts';
import { createDeliveryModule } from './modules/delivery/index.ts';
import { registerPublicApi } from './publicApi.ts';

export function createApp({ dbPath = ':memory:' }: { dbPath?: string } = {}) {
  const db = openDatabase(dbPath);
  const delivery = createDeliveryModule({ db });

  const router = createRouter();
  router.get('/routes', () => ({
    body: { app: 'Silicon Sandwiches · Delivery', style: 'modular deployment', routes: router.list() },
  }));
  router.get('/health', () => ({
    body: { status: 'ok', style: 'modular deployment', deployment: 'delivery', modules: [delivery.name] },
  }));
  registerPublicApi(router, delivery.api);
  delivery.registerRoutes(router);

  return {
    handler: router.handle,
    close: () => db.close(),
  };
}
