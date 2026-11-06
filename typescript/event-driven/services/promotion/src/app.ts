// Microsserviço Promotion: códigos promocionais e utilizações. Não chama nenhum outro serviço;
// fica a saber das encomendas ao consumir o evento OrderPlaced do broker RabbitMQ (fila dedicada e durável).
import { openDatabase } from '../../../platform/db.ts';
import { createRouter } from '../../../platform/http.ts';
import { createRabbitMQClient, type RabbitMQClient } from '../../../platform/rabbitmq.ts';
import { createPromotionRepository } from './persistence/promotionRepository.ts';
import { createPromotionService } from './business/promotionService.ts';
import { registerPromotionApi } from './api/promotionApi.ts';

const EVENTS_EXCHANGE = 'silicon.events';
const QUEUE_NAME = 'promotion.orders.placed';
const ROUTING_PATTERN = 'orders.placed';

export function createApp({
  dbPath = ':memory:',
  rabbit = createRabbitMQClient(),
}: {
  dbPath?: string;
  rabbit?: RabbitMQClient;
} = {}) {
  const db = openDatabase(dbPath, new URL('./persistence/', import.meta.url));
  const service = createPromotionService({ promotionRepository: createPromotionRepository(db) });

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
        customerId: string;
        promoCode?: string;
        discountCents: number;
      };
      if (event?.orderId && event?.customerId && event.promoCode) {
        await service.redeem({
          code: event.promoCode,
          customerId: event.customerId,
          orderId: event.orderId,
          discountCents: event.discountCents,
        });
        if (!process.env.SILENT) {
          console.log(`  [amqp] promotion consumiu OrderPlaced (#${event.orderId}, código: ${event.promoCode})`);
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
    console.error('[RabbitMQ] Erro na subscrição promotion:', err);
  });

  const router = createRouter();
  router.get('/health', () => ({ body: { status: 'ok', service: 'promotion' } }));
  registerPromotionApi(router, service);

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
