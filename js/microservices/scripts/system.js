// Arranca o sistema todo neste processo, para os testes e a demo: cada microsserviço com a sua base de
// dados em memória e no seu porto livre, e o gateway à frente. Os serviços só falam por HTTP, como em
// produção; só o arranque é que é feito aqui, por comodidade.
import { createServer } from 'node:http';
import { createApp as createCheckout } from '../services/checkout/src/app.js';
import { createApp as createLocation } from '../services/location/src/app.js';
import { createApp as createPromotion } from '../services/promotion/src/app.js';
import { createApp as createInventory } from '../services/inventory/src/app.js';
import { createApp as createRecipes } from '../services/recipes/src/app.js';
import { createApp as createKitchen } from '../services/kitchen/src/app.js';
import { createApp as createDelivery } from '../services/delivery/src/app.js';
import { createApp as createGateway } from '../gateway/src/app.js';

export function startSystem() {
  const running = {};
  const url = {};
  // Arranca um serviço (no porto indicado, para o voltar a ligar onde estava; ou num porto livre).
  function start(name, createApp, options, port = 0) {
    const app = createApp(options());
    const server = createServer(app.handler).listen(port);
    running[name] = { app, server, createApp, options };
    url[name] = `http://localhost:${server.address().port}`;
    return app;
  }
  function stop(name) {
    const { app, server } = running[name];
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
    url: `http://localhost:${gatewayServer.address().port}`,
    services: url,
    // Desliga um serviço e devolve uma função que o volta a ligar no mesmo porto (com a base de dados vazia,
    // porque está em memória: em produção seria um ficheiro e os dados voltavam com ele).
    stop(name) {
      const { createApp, options } = running[name];
      const port = Number(new URL(url[name]).port);
      stop(name);
      return () => start(name, createApp, options, port);
    },
    close() {
      gatewayServer.close();
      gatewayServer.closeAllConnections();
      for (const name of Object.keys(running)) stop(name);
    },
  };
}
