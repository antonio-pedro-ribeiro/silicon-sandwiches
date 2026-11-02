// Duplo de teste do serviço Delivery: responde ao mesmo contrato HTTP que packages/delivery, mas em
// memória. Assim os testes deste pacote não dependem do outro pacote (nem de o importar).
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createRouter } from '../src/shared/http.ts';
import { NotFoundError, ValidationError } from '../src/shared/errors.ts';
import type { DeliveryJob } from '../src/modules/delivery/index.ts';

const ZONES: Record<string, { feeCents: number; etaMinutes: number }> = {
  'porto-aliados': { feeCents: 250, etaMinutes: 30 },
  'lisboa-campo-grande': { feeCents: 300, etaMinutes: 35 },
};
const NEXT: Record<string, string> = { SCHEDULED: 'OUT_FOR_DELIVERY', OUT_FOR_DELIVERY: 'DELIVERED' };

// Os pedidos chegam do pacote sandwiches, que é quem estamos a testar: confia-se no formato.
interface QuoteRequest { store: { id: string; name: string } }
interface ScheduleRequest { order: { id: number; storeId: string }; address: string }

export function startFakeDelivery() {
  const jobs: DeliveryJob[] = [];
  const router = createRouter();
  router.post('/api/quotes', ({ body }) => {
    const { store } = body as QuoteRequest;
    const zone = ZONES[store.id];
    return { body: zone ? { available: true, ...zone } : { available: false, reason: `A loja ${store.name} não faz entregas` } };
  });
  router.post('/api/deliveries', ({ body }) => {
    const { order, address } = body as ScheduleRequest;
    const job = {
      id: jobs.length + 1,
      orderId: order.id,
      storeId: order.storeId,
      address,
      status: 'SCHEDULED',
      etaMinutes: ZONES[order.storeId].etaMinutes,
    };
    jobs.unshift(job);
    return { status: 201, body: job };
  });
  router.get('/deliveries', () => ({ body: jobs }));
  router.post('/deliveries/:id/advance', ({ params }) => {
    const job = jobs.find((j) => j.id === Number(params.id));
    if (!job) throw new NotFoundError(`Entrega ${params.id} não existe`);
    const next = NEXT[job.status];
    if (!next) throw new ValidationError(`A entrega ${job.id} já foi concluída`);
    job.status = next;
    return { body: job };
  });

  const server = createServer(router.handle).listen(0);
  return { url: `http://localhost:${(server.address() as AddressInfo).port}`, close: () => server.close() };
}
