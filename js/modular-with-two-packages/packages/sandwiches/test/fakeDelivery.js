// Duplo de teste do serviço Delivery: responde ao mesmo contrato HTTP que packages/delivery, mas em
// memória. Assim os testes deste pacote não dependem do outro pacote (nem de o importar).
import { createServer } from 'node:http';
import { createRouter } from '../src/shared/http.js';
import { NotFoundError, ValidationError } from '../src/shared/errors.js';

const ZONES = { 'porto-aliados': { feeCents: 250, etaMinutes: 30 }, 'lisboa-campo-grande': { feeCents: 300, etaMinutes: 35 } };
const NEXT = { SCHEDULED: 'OUT_FOR_DELIVERY', OUT_FOR_DELIVERY: 'DELIVERED' };

export function startFakeDelivery() {
  const jobs = [];
  const router = createRouter();
  router.post('/api/quotes', ({ body }) => {
    const zone = ZONES[body.store.id];
    return { body: zone ? { available: true, ...zone } : { available: false, reason: `A loja ${body.store.name} não faz entregas` } };
  });
  router.post('/api/deliveries', ({ body }) => {
    const job = {
      id: jobs.length + 1,
      orderId: body.order.id,
      storeId: body.order.storeId,
      address: body.address,
      status: 'SCHEDULED',
      etaMinutes: ZONES[body.order.storeId].etaMinutes,
    };
    jobs.unshift(job);
    return { status: 201, body: job };
  });
  router.get('/deliveries', () => ({ body: jobs }));
  router.post('/deliveries/:id/advance', ({ params }) => {
    const job = jobs.find((j) => j.id === Number(params.id));
    if (!job) throw new NotFoundError(`Entrega ${params.id} não existe`);
    if (!NEXT[job.status]) throw new ValidationError(`A entrega ${job.id} já foi concluída`);
    job.status = NEXT[job.status];
    return { body: job };
  });

  const server = createServer(router.handle).listen(0);
  return { url: `http://localhost:${server.address().port}`, close: () => server.close() };
}
