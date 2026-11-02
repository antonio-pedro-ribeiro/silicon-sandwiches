// Arranca o sistema todo neste processo, para os testes e a demo: cada microsserviço com a sua base de
// dados em memória e no seu porto livre, e o gateway à frente. Os serviços só falam por HTTP, como em
// produção; só o arranque é que é feito aqui, por comodidade.
import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp as createCheckout } from '../services/checkout/src/app.ts';
import { createApp as createLocation } from '../services/location/src/app.ts';
import { createApp as createPromotion } from '../services/promotion/src/app.ts';
import { createApp as createInventory } from '../services/inventory/src/app.ts';
import { createApp as createRecipes } from '../services/recipes/src/app.ts';
import { createApp as createKitchen } from '../services/kitchen/src/app.ts';
import { createApp as createDelivery } from '../services/delivery/src/app.ts';
import { createApp as createGateway } from '../gateway/src/app.ts';

type ServiceName = 'checkout' | 'location' | 'promotion' | 'inventory' | 'recipes' | 'kitchen' | 'delivery';
interface App { handler: RequestListener; close(): void }
interface Running { app: App; server: Server; restart: (port: number) => App }

export function startSystem() {
  const running: Partial<Record<ServiceName, Running>> = {};
  const url: Record<string, string> = {};
  // Arranca um serviço (no porto indicado, para o voltar a ligar onde estava; ou num porto livre).
  function start<O, A extends App>(name: ServiceName, createApp: (options: O) => A, options: () => O, port = 0): A {
    const app = createApp(options());
    const server = createServer(app.handler).listen(port);
    running[name] = { app, server, restart: (p) => start(name, createApp, options, p) };
    url[name] = `http://localhost:${(server.address() as AddressInfo).port}`;
    return app;
  }
  function stop(name: ServiceName): void {
    const { app, server } = running[name]!;
    delete running[name];
    server.close();
    server.closeAllConnections();
    app.close();
  }

  // Primeiro os serviços sem dependências; depois os que precisam de saber onde estão os outros.
  start('location', createLocation, () => ({}));
  start('recipes', createRecipes, () => ({}));
  start('promotion', createPromotion, () => ({}));
  start('kitchen', createKitchen, () => ({}));
  start('delivery', createDelivery, () => ({}));
  start('inventory', createInventory, () => ({ services: { recipes: url.recipes } }));
  const checkout = start('checkout', createCheckout, () => ({
    services: { location: url.location, promotion: url.promotion, delivery: url.delivery, inventory: url.inventory },
    subscribers: { promotion: url.promotion, kitchen: url.kitchen, delivery: url.delivery },
  }));
  const gateway = createGateway({ services: Object.fromEntries(Object.entries(url).map(([n, u]) => [n, [u]])) });
  const gatewayServer = createServer(gateway.handler).listen(0);

  return {
    app: checkout,    // o serviço Checkout, para os testes que chamam o checkout diretamente
    url: `http://localhost:${(gatewayServer.address() as AddressInfo).port}`,
    services: url,
    // Desliga um serviço e devolve uma função que o volta a ligar no mesmo porto (com a base de dados vazia,
    // porque está em memória: em produção seria um ficheiro e os dados voltavam com ele).
    stop(name: ServiceName): () => App {
      const { restart } = running[name]!;
      const port = Number(new URL(url[name]).port);
      stop(name);
      return () => restart(port);
    },
    close() {
      gatewayServer.close();
      gatewayServer.closeAllConnections();
      for (const name of Object.keys(running) as ServiceName[]) stop(name);
    },
  };
}
