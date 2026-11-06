// Microsserviço Kitchen (MakeOrder): a fila de bilhetes de cada loja. Não chama nenhum outro serviço;
// cria os bilhetes quando consome o evento OrderPlaced do broker RabbitMQ (fila dedicada e durável).
import { openDatabase } from '../../../platform/db.ts';
import { createRouter } from '../../../platform/http.ts';
import { createRabbitMQClient, type RabbitMQClient } from '../../../platform/rabbitmq.ts';
import { createKitchenRepository } from './persistence/kitchenRepository.ts';
import { createMakeOrderService } from './business/makeOrderService.ts';
import { registerKitchenApi } from './api/kitchenApi.ts';

const EVENTS_EXCHANGE = 'silicon.events';
const QUEUE_NAME = 'kitchen.orders.placed';
const ROUTING_PATTERN = 'orders.placed';

export function createApp({
  dbPath = ':memory:',
  rabbit = createRabbitMQClient(),
}: {
  dbPath?: string;
  rabbit?: RabbitMQClient;
} = {}) {
  const db = openDatabase(dbPath, new URL('./persistence/', import.meta.url));
  const service = createMakeOrderService({ kitchenRepository: createKitchenRepository(db) });

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
        items: { name: string; quantity: number }[];
      };
      if (event?.orderId && event?.storeId && Array.isArray(event.items)) {
        await service.enqueue({ orderId: event.orderId, storeId: event.storeId, items: event.items });
        if (!process.env.SILENT) {
          console.log(`  [amqp] kitchen consumiu OrderPlaced (#${event.orderId})`);
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
    console.error('[RabbitMQ] Erro na subscrição kitchen:', err);
  });

  const router = createRouter();
  router.get('/health', () => ({ body: { status: 'ok', service: 'kitchen' } }));
  registerKitchenApi(router, service);

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
