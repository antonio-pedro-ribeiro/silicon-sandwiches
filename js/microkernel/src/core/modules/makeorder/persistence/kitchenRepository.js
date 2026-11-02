// Bilhetes da cozinha (um por encomenda) e os seus artigos.
import { transaction } from '../../../shared/db.js';

export function createKitchenRepository(db) {
  const insertTicket = db.prepare("INSERT INTO kitchen_ticket (order_id, store_id, status) VALUES (?, ?, 'QUEUED')");
  const insertItem = db.prepare('INSERT INTO kitchen_ticket_item (ticket_id, name, quantity) VALUES (?, ?, ?)');
  const all = db.prepare('SELECT * FROM kitchen_ticket ORDER BY id DESC');
  const byStore = db.prepare('SELECT * FROM kitchen_ticket WHERE store_id = ? ORDER BY id DESC');
  const byId = db.prepare('SELECT * FROM kitchen_ticket WHERE id = ?');
  const items = db.prepare('SELECT name, quantity FROM kitchen_ticket_item WHERE ticket_id = ? ORDER BY name');
  const updateStatus = db.prepare("UPDATE kitchen_ticket SET status = ?, updated_at = datetime('now') WHERE id = ?");

  const toTicket = (r) => r && {
    id: r.id,
    orderId: r.order_id,
    storeId: r.store_id,
    status: r.status,
    items: items.all(r.id).map((i) => ({ ...i })),
    receivedAt: r.received_at,
    updatedAt: r.updated_at,
  };

  return {
    create: ({ orderId, storeId, items: lines }) => {
      const id = transaction(db, () => {
        const ticketId = Number(insertTicket.run(orderId, storeId).lastInsertRowid);
        for (const l of lines) insertItem.run(ticketId, l.name, l.quantity);
        return ticketId;
      });
      return toTicket(byId.get(id));
    },
    findAll: (storeId) => (storeId ? byStore.all(storeId) : all.all()).map(toTicket),
    findById: (id) => toTicket(byId.get(id)),
    setStatus: (id, status) => updateStatus.run(status, id),
  };
}
