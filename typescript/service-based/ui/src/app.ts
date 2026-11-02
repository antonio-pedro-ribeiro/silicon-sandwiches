// A interface de utilizador, implantada à parte dos serviços: serve a página e, como API gateway,
// encaminha os pedidos do browser para os serviços de domínio. Não acede à base de dados.
import { createRouter } from '../../libs/platform/http.ts';
import { registerWebRoutes } from './web/webController.ts';
import { createGateway, type ServiceUrls } from './gateway.ts';

export function createApp({ services }: { services: ServiceUrls }) {
  const gateway = createGateway(services);
  const router = createRouter();
  registerWebRoutes(router);
  router.get('/routes', () => ({
    body: { app: 'Silicon Sandwiches', style: 'service-based', routes: router.list() },
  }));
  router.get('/health', async () => ({
    body: { status: 'ok', style: 'service-based', database: 'partilhada', services: await gateway.health() },
  }));
  gateway.register(router);

  return { handler: router.handle };
}
