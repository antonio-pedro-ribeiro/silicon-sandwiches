// O API gateway, que também serve a interface web (uma interface monolítica, à frente dos sete serviços).
import { createRouter } from '../../platform/http.ts';
import { registerWebRoutes } from './web/webController.ts';
import { createGateway, type ServiceUrls } from './gateway.ts';

export function createApp({ services }: { services: ServiceUrls }) {
  const gateway = createGateway(services);
  const router = createRouter();
  registerWebRoutes(router);
  router.get('/routes', () => ({
    body: { app: 'Silicon Sandwiches', style: 'event-driven', routes: router.list() },
  }));
  router.get('/health', async () => ({
    body: { status: 'ok', style: 'event-driven', database: 'uma por serviço + broker RabbitMQ', services: await gateway.health() },
  }));
  gateway.register(router);

  return { handler: router.handle };
}
