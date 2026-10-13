// A API pública do módulo (o que o index.js exporta: quote e schedule), agora publicada por HTTP.
// É o contrato com o pacote sandwiches: só passam ids e dados simples, nunca objetos internos.
import { ValidationError } from './shared/errors.js';

export function registerPublicApi(router, api) {
  router.post('/api/quotes', async ({ body }) => {
    if (typeof body?.store?.id !== 'string') throw new ValidationError('store.id é obrigatório');
    return { body: await api.quote({ store: body.store, address: body.address }) };
  });

  router.post('/api/deliveries', async ({ body }) => {
    const { order, address } = body ?? {};
    if (!Number.isInteger(order?.id) || typeof order?.storeId !== 'string' || !address) {
      throw new ValidationError('order.id, order.storeId e address são obrigatórios');
    }
    return { status: 201, body: await api.schedule({ order, address }) };
  });
}
