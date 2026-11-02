// O API gateway, que também serve a interface web (uma interface monolítica, à frente dos sete serviços).
import { createRouter } from '../../platform/http.js';
import { registerWebRoutes } from './web/webController.js';
import { createGateway } from './gateway.js';

export function createApp({ services }) {
  const gateway = createGateway(services);
  const router = createRouter();
  registerWebRoutes(router);
  router.get('/routes', () => ({
    body: { app: 'Silicon Sandwiches', style: 'microservices', routes: router.list() },
  }));
  router.get('/health', async () => ({
    body: { status: 'ok', style: 'microservices', database: 'uma por serviço', services: await gateway.health() },
  }));
  gateway.register(router);

  return { handler: router.handle };
}
