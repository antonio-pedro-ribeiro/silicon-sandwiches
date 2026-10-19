// Outbox: eventos gravados na base de dados do Checkout, à espera de serem publicados.
export function createOutboxRepository(db) {
  const insert = db.prepare('INSERT INTO checkout_outbox (type, payload) VALUES (?, ?)');
  const pending = db.prepare('SELECT id, type, payload FROM checkout_outbox WHERE dispatched_at IS NULL ORDER BY id');
  const markDispatched = db.prepare("UPDATE checkout_outbox SET dispatched_at = datetime('now') WHERE id = ?");

  return {
    add: (type, payload) => insert.run(type, JSON.stringify(payload)),
    pending: () => pending.all().map((r) => ({ id: r.id, type: r.type, ...JSON.parse(r.payload) })),
    markDispatched: (id) => markDispatched.run(id),
  };
}
