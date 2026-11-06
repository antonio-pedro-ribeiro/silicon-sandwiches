// Os outros serviços, vistos daqui: as mesmas funções que o CatalogCheckout recebia no monólito modular
// (getStore, discountFor, quote, reserve, release), mas cada uma é agora um pedido HTTP.
// Só seguem pela rede os campos de que o outro serviço precisa.
// Os tipos das respostas são o contrato com cada serviço (não se importa código deles).
import { createServiceClient } from '../../../platform/serviceClient.ts';
import type { CheckoutDependencies } from './business/checkoutService.ts';

type Clients = Pick<CheckoutDependencies, 'location' | 'promotion' | 'delivery' | 'inventory'>;

export type ServiceUrls = Record<'location' | 'promotion' | 'delivery' | 'inventory', string>;

const undefinedIfNotFound = (err: Error): undefined => {
  if (err.name === 'NotFoundError') return undefined;
  throw err;
};

export function createClients(services: ServiceUrls): Clients {
  const client = (to: keyof ServiceUrls) => createServiceClient({ from: 'checkout', to, baseUrl: services[to] });
  const location = client('location');
  const promotion = client('promotion');
  const delivery = client('delivery');
  const inventory = client('inventory');

  return {
    location: {
      getStore: (id) =>
        location.get<{ id: string; name: string; open: boolean }>(`/api/stores/${encodeURIComponent(id)}`).catch(undefinedIfNotFound),
    },
    promotion: {
      discountFor: (query) => promotion.post('/api/discounts', query),
    },
    delivery: {
      quote: ({ store }) => delivery.post('/api/quotes', { store: { id: store.id, name: store.name } }),
    },
    inventory: {
      reserve: (storeId, lines) => inventory.post('/api/reservations', {
        storeId, lines: lines.map(({ sandwichId, name, quantity }) => ({ sandwichId, name, quantity })),
      }),
      release: (reservationId) => inventory.post(`/api/reservations/${reservationId}/release`),
    },
  };
}
