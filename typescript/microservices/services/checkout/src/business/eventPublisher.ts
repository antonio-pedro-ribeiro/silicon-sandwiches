// Publica os eventos do outbox: cada evento vai, por HTTP, para todos os subscritores
// (POST <subscritor>/events/order-placed). Um evento só sai do outbox quando todos o receberam; se algum
// estiver em baixo, volta a ser enviado de RETRY_MS em RETRY_MS. Por isso os subscritores têm de ser
// idempotentes: o mesmo evento pode chegar mais de uma vez.
// O Checkout não sabe o que cada subscritor faz com o evento (coreografia), nem quais são:
// a lista chega por configuração. Em produção, este papel seria de um broker (Kafka, RabbitMQ…).
import { createServiceClient } from '../../../../platform/serviceClient.ts';
import type { EventType, OutboxRepository } from '../persistence/outboxRepository.ts';

const RETRY_MS = 2000;
const PATH: Record<EventType, string> = { OrderPlaced: '/events/order-placed' };

export type EventPublisher = ReturnType<typeof createEventPublisher>;

export function createEventPublisher(
  { outbox, subscribers }: { outbox: OutboxRepository; subscribers: Record<string, string> },
) {
  const clients = Object.entries(subscribers).map(([to, baseUrl]) => createServiceClient({ from: 'checkout', to, baseUrl }));
  let queue = Promise.resolve();

  async function dispatchOnce(): Promise<void> {
    for (const event of outbox.pending()) {
      const delivered = await Promise.all(clients.map((c) => c.post(PATH[event.type], event).then(() => true, () => false)));
      if (delivered.every(Boolean)) outbox.markDispatched(event.id);
    }
  }

  // Uma passagem de cada vez: a seguinte espera que a anterior acabe.
  function dispatchPending(): Promise<void> {
    queue = queue.then(dispatchOnce).catch((err) => console.error('Falha ao publicar eventos:', err));
    return queue;
  }

  const timer = setInterval(dispatchPending, RETRY_MS);
  timer.unref();

  return { dispatchPending, stop: () => clearInterval(timer) };
}
