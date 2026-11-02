// Bilhetes da cozinha (um por encomenda) e os seus artigos.
import { rowsOf, transaction, type Database } from '../../../../platform/db.ts';

export type TicketStatus = 'QUEUED' | 'PREPARING' | 'READY' | 'COLLECTED';

export interface TicketItem {
  name: string;
  quantity: number;
}

export interface NewTicket {
  orderId: number;
  storeId: string;
  items: TicketItem[];
}

export interface KitchenTicket extends NewTicket {
  id: number;
  status: TicketStatus;
  receivedAt: string;
  updatedAt: string;
}

interface TicketRow {
  id: number;
  order_id: number;
  store_id: string;
  status: TicketStatus;
  received_at: string;
  updated_at: string;
}

export type KitchenRepository = ReturnType<typeof createKitchenRepository>;

export function createKitchenRepository(db: Database) {
  const insertTicket = db.prepare("INSERT INTO kitchen_ticket (order_id, store_id, status) VALUES (?, ?, 'QUEUED')");
  const insertItem = db.prepare('INSERT INTO kitchen_ticket_item (ticket_id, name, quantity) VALUES (?, ?, ?)');
  const all = db.prepare('SELECT * FROM kitchen_ticket ORDER BY id DESC');
  const byStore = db.prepare('SELECT * FROM kitchen_ticket WHERE store_id = ? ORDER BY id DESC');
  const byId = db.prepare('SELECT * FROM kitchen_ticket WHERE id = ?');
  const byOrder = db.prepare('SELECT * FROM kitchen_ticket WHERE order_id = ?');
  const items = db.prepare('SELECT name, quantity FROM kitchen_ticket_item WHERE ticket_id = ? ORDER BY name');
  const updateStatus = db.prepare("UPDATE kitchen_ticket SET status = ?, updated_at = datetime('now') WHERE id = ?");

  const toTicket = (r: TicketRow): KitchenTicket => ({
    id: r.id,
    orderId: r.order_id,
    storeId: r.store_id,
    status: r.status,
    items: rowsOf<TicketItem>(items.all(r.id)).map((i) => ({ ...i })),
    receivedAt: r.received_at,
    updatedAt: r.updated_at,
  });
  const findById = (id: number): KitchenTicket | undefined => {
    const row = byId.get(id) as TicketRow | undefined;
    return row && toTicket(row);
  };

  return {
    create: ({ orderId, storeId, items: lines }: NewTicket): KitchenTicket => {
      const id = transaction(db, () => {
        const ticketId = Number(insertTicket.run(orderId, storeId).lastInsertRowid);
        for (const l of lines) insertItem.run(ticketId, l.name, l.quantity);
        return ticketId;
      });
      return findById(id)!;
    },
    findAll: (storeId?: string | null): KitchenTicket[] =>
      rowsOf<TicketRow>(storeId ? byStore.all(storeId) : all.all()).map(toTicket),
    findById,
    findByOrder: (orderId: number): KitchenTicket | undefined => {
      const row = byOrder.get(orderId) as TicketRow | undefined;
      return row && toTicket(row);
    },
    setStatus: (id: number, status: TicketStatus) => updateStatus.run(status, id),
  };
}
