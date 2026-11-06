// Microsserviço Delivery: zonas (taxa e tempo por loja) e entregas. Não chama nenhum outro serviço;
// agenda as entregas quando consome o evento OrderPlaced do broker RabbitMQ (fila dedicada e durável).
import { openDatabase } from '../../../platform/db.ts';
import { createRouter } from '../../../platform/http.ts';
import { createRabbitMQClient, type RabbitMQClient } from '../../../platform/rabbitmq.ts';
import { createDeliveryRepository } from './persistence/deliveryRepository.ts';
import { createDeliveryService } from './business/deliveryService.ts';
import { registerDeliveryApi } from './api/deliveryApi.ts';

const EVENTS_EXCHANGE = 'silicon.events';
const QUEUE_NAME = 'delivery.orders.placed';
const ROUTING_PATTERN = 'orders.placed';

export function createApp({
  dbPath = ':memory:',
  rabbit = createRabbitMQClient(),
}: {
  dbPath?: string;
  rabbit?: RabbitMQClient;
} = {}) {
  const db = openDatabase(dbPath, new URL('./persistence/', import.meta.url));
  const service = createDeliveryService({ deliveryRepository: createDeliveryRepository(db) });

  let closed = false;
  let unsubscribe: (() => Promise<void>) | null = null;
  const subscriberPromise = rabbit.subscribe(
    EVENTS_EXCHANGE,
    QUEUE_NAME,
    ROUTING_PATTERN,
    async (payload) => {
      if (closed) return;
      const event = (payload && typeof payload === 'object' && 'payload' in payload ? (payload as { payload: unknown }).payload : payload) as {
        orderId: number;
        storeId: string;
        fulfilment: string;
        address?: string;
      };
      if (event?.orderId && event?.storeId && event.fulfilment === 'delivery' && event.address) {
        await service.schedule({ orderId: event.orderId, storeId: event.storeId, address: event.address });
        if (!process.env.SILENT) {
          console.log(`  [amqp] delivery consumiu OrderPlaced (#${event.orderId})`);
        }
      }
    },
  ).then((unsub) => {
    unsubscribe = unsub;
    if (closed) {
      void unsub();
      unsubscribe = null;
    }
  }).catch((err) => {
    console.error('[RabbitMQ] Erro na subscrição delivery:', err);
  });

  const router = createRouter();
  router.get('/health', () => ({ body: { status: 'ok', service: 'delivery' } }));
  registerDeliveryApi(router, service);

  return {
    handler: router.handle,
    ready: () => subscriberPromise,
    close: async () => {
      closed = true;
      if (unsubscribe) {
        await unsubscribe();
        unsubscribe = null;
      }
      db.close();
      await rabbit.close().catch(() => {});
    },
  };
}
