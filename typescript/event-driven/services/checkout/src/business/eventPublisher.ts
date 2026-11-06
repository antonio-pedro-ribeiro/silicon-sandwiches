// Publica os eventos do outbox para o broker RabbitMQ via Exchange (amq.topic ou silicon.events).
// O padrão Outbox transacional garante persistência atómica com a encomenda na base de dados SQLite.
// O EventPublisher lê eventos pendentes do outbox e publica-os no RabbitMQ.
// Uma vez confirmado pelo broker, o evento é marcado como dispatched.
// Se RabbitMQ estiver indisponível temporariamente, os eventos continuam retidos no outbox
// e são reenviados na próxima passagem (at-least-once delivery).
import type { RabbitMQClient } from '../../../../platform/rabbitmq.ts';
import type { EventType, OutboxRepository } from '../persistence/outboxRepository.ts';

const RETRY_MS = 2000;
export const EVENTS_EXCHANGE = 'silicon.events';
const ROUTING_KEY: Record<EventType, string> = { OrderPlaced: 'orders.placed' };

export type EventPublisher = ReturnType<typeof createEventPublisher>;

export function createEventPublisher(
  { outbox, rabbit }: { outbox: OutboxRepository; rabbit: RabbitMQClient },
) {
  let queue = Promise.resolve();

  async function dispatchOnce(): Promise<void> {
    for (const event of outbox.pending()) {
      try {
        const routingKey = ROUTING_KEY[event.type] ?? `event.${event.type.toLowerCase()}`;
        await rabbit.publish(EVENTS_EXCHANGE, routingKey, event);
        outbox.markDispatched(event.id);
        if (!process.env.SILENT) {
          console.log(`  [amqp] checkout publicou ${event.type} (#${event.id}) -> exchange '${EVENTS_EXCHANGE}' (${routingKey})`);
        }
      } catch (err) {
        if (!process.env.SILENT) {
          console.log(`  [amqp] falha ao publicar ${event.type} (#${event.id}): ${(err as Error).message}`);
        }
      }
    }
  }

  // Uma passagem de cada vez: a seguinte espera que a anterior acabe.
  function dispatchPending(): Promise<void> {
    queue = queue.then(dispatchOnce).catch((err) => console.error('Falha ao publicar eventos no broker RabbitMQ:', err));
    return queue;
  }

  const timer = setInterval(dispatchPending, RETRY_MS);
  timer.unref();

  return { dispatchPending, stop: () => clearInterval(timer) };
}
