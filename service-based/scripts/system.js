// Arranca o sistema todo neste processo, para os testes e a demo: a base de dados partilhada num
// ficheiro temporário (todos os serviços abrem o mesmo ficheiro, cada um com a sua ligação), cada
// serviço no seu porto livre e a interface/gateway apontada para eles. Os pedidos entre o gateway
// e os serviços são HTTP, como em produção.
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setupDatabase } from '../database/setup.js';
import { createApp as createOrders } from '../services/orders/src/app.js';
import { createApp as createStores } from '../services/stores/src/app.js';
import { createApp as createKitchen } from '../services/kitchen/src/app.js';
import { createApp as createDelivery } from '../services/delivery/src/app.js';
import { createApp as createUi } from '../ui/src/app.js';

const FACTORIES = { orders: createOrders, stores: createStores, kitchen: createKitchen, delivery: createDelivery };

export function startSystem({ ordersInstances = 1 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'silicon-sandwiches-'));
  const dbPath = join(dir, 'silicon-sandwiches.db');
  setupDatabase(dbPath);

  const instances = [];
  function start(name, port = 0) {
    const app = FACTORIES[name]({ dbPath });
    const server = createServer(app.handler).listen(port);
    const instance = { name, app, server, url: `http://localhost:${server.address().port}` };
    instances.push(instance);
    return instance;
  }
  function stop(instance) {
    instance.server.close();
    instance.server.closeAllConnections();
    instance.app.close();
    instances.splice(instances.indexOf(instance), 1);
  }

  const orders = Array.from({ length: ordersInstances }, () => start('orders'));
  const others = Object.fromEntries(['stores', 'kitchen', 'delivery'].map((name) => [name, start(name)]));
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
    url: `http://localhost:${uiServer.address().port}`,
    dbPath,
    // Desliga um serviço (Stores, Kitchen ou Delivery) e devolve uma função que o volta a ligar no mesmo porto.
    stop(name) {
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
