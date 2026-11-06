// Arranca o sistema todo neste processo, para os testes e a demo: cada microsserviço com a sua base de
// dados em memória e no seu porto livre, o gateway à frente e o broker RabbitMQ para comunicação orientada a eventos.
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
import { createRabbitMQClient, sharedMemoryBroker, type RabbitMQClient } from '../platform/rabbitmq.ts';

type ServiceName = 'checkout' | 'location' | 'promotion' | 'inventory' | 'recipes' | 'kitchen' | 'delivery';
interface App { handler: RequestListener; close(): void | Promise<void>; ready?: () => Promise<unknown> }
interface Running { app: App; server: Server; restart: (port: number) => Promise<App> }

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.closeAllConnections();
    server.close(() => resolve());
  });
}

export function startSystem(options?: { rabbit?: RabbitMQClient }) {
  const running: Partial<Record<ServiceName, Running>> = {};
  const url: Record<string, string> = {};
  const rabbit = options?.rabbit ?? createRabbitMQClient({ broker: sharedMemoryBroker });

  function start<O, A extends App>(name: ServiceName, createApp: (options: O) => A, options: () => O, port = 0): A {
    const app = createApp(options());
    const server = createServer(app.handler).listen(port);
    running[name] = {
      app,
      server,
      restart: async (p) => {
        const restartedApp = start(name, createApp, options, p);
        if (restartedApp.ready) await restartedApp.ready();
        return restartedApp;
      },
    };
    url[name] = `http://localhost:${(server.address() as AddressInfo).port}`;
    return app;
  }

  async function stop(name: ServiceName): Promise<void> {
    const item = running[name];
    if (!item) return;
    delete running[name];
    await closeServer(item.server);
    await item.app.close();
  }

  // Serviços base
  start('location', createLocation, () => ({}));
  start('recipes', createRecipes, () => ({}));
  start('promotion', createPromotion, () => ({ rabbit }));
  start('kitchen', createKitchen, () => ({ rabbit }));
  start('delivery', createDelivery, () => ({ rabbit }));
  start('inventory', createInventory, () => ({ services: { recipes: url.recipes } }));
  const checkout = start('checkout', createCheckout, () => ({
    services: { location: url.location, promotion: url.promotion, delivery: url.delivery, inventory: url.inventory },
    rabbit,
  }));
  const gateway = createGateway({ services: Object.fromEntries(Object.entries(url).map(([n, u]) => [n, [u]])) });
  const gatewayServer = createServer(gateway.handler).listen(0);

  return {
    app: checkout,
    rabbit,
    url: `http://localhost:${(gatewayServer.address() as AddressInfo).port}`,
    services: url,
    stop(name: ServiceName): () => Promise<App> {
      const { restart } = running[name]!;
      const port = Number(new URL(url[name]).port);
      const stoppedPromise = stop(name);
      return async () => {
        await stoppedPromise;
        return restart(port);
      };
    },
    async close() {
      await closeServer(gatewayServer);
      for (const name of Object.keys(running) as ServiceName[]) {
        await stop(name);
      }
      await rabbit.close().catch(() => {});
      sharedMemoryBroker.reset();
    },
  };
}
