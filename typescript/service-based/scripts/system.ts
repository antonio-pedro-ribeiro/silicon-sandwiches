// Arranca o sistema todo neste processo, para os testes e a demo: a base de dados partilhada num
// ficheiro temporário (todos os serviços abrem o mesmo ficheiro, cada um com a sua ligação), cada
// serviço no seu porto livre e a interface/gateway apontada para eles. Os pedidos entre o gateway
// e os serviços são HTTP, como em produção.
import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setupDatabase } from '../database/setup.ts';
import { createApp as createOrders } from '../services/orders/src/app.ts';
import { createApp as createStores } from '../services/stores/src/app.ts';
import { createApp as createKitchen } from '../services/kitchen/src/app.ts';
import { createApp as createDelivery } from '../services/delivery/src/app.ts';
import { createApp as createUi } from '../ui/src/app.ts';

const FACTORIES = { orders: createOrders, stores: createStores, kitchen: createKitchen, delivery: createDelivery };
type ServiceName = keyof typeof FACTORIES;
interface Instance { name: ServiceName; app: { handler: RequestListener; close(): void }; server: Server; url: string }

export function startSystem({ ordersInstances = 1 }: { ordersInstances?: number } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'silicon-sandwiches-'));
  const dbPath = join(dir, 'silicon-sandwiches.db');
  setupDatabase(dbPath);

  const instances: Instance[] = [];
  function start<N extends ServiceName>(name: N, port = 0) {
    const app = FACTORIES[name]({ dbPath }) as ReturnType<(typeof FACTORIES)[N]>;
    const server = createServer(app.handler).listen(port);
    const instance = { name, app, server, url: `http://localhost:${(server.address() as AddressInfo).port}` };
    instances.push(instance);
    return instance;
  }
  function stop(instance: Instance): void {
    instance.server.close();
    instance.server.closeAllConnections();
    instance.app.close();
    instances.splice(instances.indexOf(instance), 1);
  }

  const orders = Array.from({ length: ordersInstances }, () => start('orders'));
  const others: Record<string, Instance> = Object.fromEntries(
    (['stores', 'kitchen', 'delivery'] as const).map((name) => [name, start(name)]),
  );
  const ui = createUi({
    services: {
      orders: orders.map((o) => o.url),
      ...Object.fromEntries(Object.entries(others).map(([name, i]) => [name, [i.url]])),
    },
  });
  const uiServer = createServer(ui.handler).listen(0);

  return {
    app: orders[0].app,   // o serviço Orders, para os testes que chamam o checkout diretamente
    orders: orders.map((o) => o.app),
    url: `http://localhost:${(uiServer.address() as AddressInfo).port}`,
    dbPath,
    // Desliga um serviço (Stores, Kitchen ou Delivery) e devolve uma função que o volta a ligar no mesmo porto.
    stop(name: 'stores' | 'kitchen' | 'delivery'): () => void {
      const instance = others[name];
      const port = Number(new URL(instance.url).port);
      stop(instance);
      return () => { others[name] = start(name, port); };
    },
    close() {
      uiServer.close();
      uiServer.closeAllConnections();
      for (const instance of [...instances]) stop(instance);
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
