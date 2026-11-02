// Outbox: eventos gravados na base de dados do Checkout, à espera de serem publicados.
import { rowsOf, type Database } from '../../../../platform/db.ts';

export type EventType = 'OrderPlaced';

export interface OutboxEvent {
  id: number;
  type: EventType;
  [field: string]: unknown;  // o conteúdo do evento (payload), espalhado
}

interface OutboxRow { id: number; type: EventType; payload: string }

export type OutboxRepository = ReturnType<typeof createOutboxRepository>;

export function createOutboxRepository(db: Database) {
  const insert = db.prepare('INSERT INTO checkout_outbox (type, payload) VALUES (?, ?)');
  const pending = db.prepare('SELECT id, type, payload FROM checkout_outbox WHERE dispatched_at IS NULL ORDER BY id');
  const markDispatched = db.prepare("UPDATE checkout_outbox SET dispatched_at = datetime('now') WHERE id = ?");

  return {
    add: (type: EventType, payload: object) => insert.run(type, JSON.stringify(payload)),
    pending: (): OutboxEvent[] =>
      rowsOf<OutboxRow>(pending.all()).map((r) => ({ id: r.id, type: r.type, ...JSON.parse(r.payload) })),
    markDispatched: (id: number) => markDispatched.run(id),
  };
}
