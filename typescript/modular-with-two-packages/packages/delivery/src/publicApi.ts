// A API pública do módulo (o que o index.ts exporta: quote e schedule), agora publicada por HTTP.
// É o contrato com o pacote sandwiches: só passam ids e dados simples, nunca objetos internos.
import { ValidationError } from './shared/errors.ts';
import type { Router } from './shared/http.ts';
import type { DeliveryApi } from './modules/delivery/index.ts';

export function registerPublicApi(router: Router, api: DeliveryApi): void {
  router.post('/api/quotes', async ({ body }) => {
    const { store, address } = (body ?? {}) as { store?: { id?: unknown; name: string }; address?: string };
    if (typeof store?.id !== 'string') throw new ValidationError('store.id é obrigatório');
    return { body: await api.quote({ store: { id: store.id, name: store.name }, address }) };
  });

  router.post('/api/deliveries', async ({ body }) => {
    const { order, address } = (body ?? {}) as { order?: { id?: unknown; storeId?: unknown }; address?: unknown };
    if (typeof order?.id !== 'number' || !Number.isInteger(order.id) || typeof order.storeId !== 'string'
      || typeof address !== 'string' || !address) {
      throw new ValidationError('order.id, order.storeId e address são obrigatórios');
    }
    return { status: 201, body: await api.schedule({ order: { id: order.id, storeId: order.storeId }, address }) };
  });
}
