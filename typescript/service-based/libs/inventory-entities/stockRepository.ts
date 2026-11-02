// Stock de ingredientes por loja e reservas. Reservar e libertar são transações SQL.
import { rowsOf, transaction, type Database } from '../platform/db.ts';

export interface StockLevel {
  ingredient: string;
  quantity: number;
}

export type ReservationResult =
  | { ok: true; reservationId: number }
  | { ok: false; ingredient: string };

interface ReservationRow { id: number; store_id: string; status: 'ACTIVE' | 'RELEASED' }

class OutOfStock extends Error {}

export type StockRepository = ReturnType<typeof createStockRepository>;

export function createStockRepository(db: Database) {
  const byStore = db.prepare('SELECT ingredient, quantity FROM inventory_stock_level WHERE store_id = ? ORDER BY ingredient');
  const take = db.prepare(
    'UPDATE inventory_stock_level SET quantity = quantity - ? WHERE store_id = ? AND ingredient = ? AND quantity >= ?',
  );
  const give = db.prepare(`
    INSERT INTO inventory_stock_level (store_id, ingredient, quantity) VALUES (?, ?, ?)
    ON CONFLICT (store_id, ingredient) DO UPDATE SET quantity = quantity + excluded.quantity`);
  const insertReservation = db.prepare("INSERT INTO inventory_stock_reservation (store_id, status) VALUES (?, 'ACTIVE')");
  const insertReservationLine = db.prepare(
    'INSERT INTO inventory_stock_reservation_line (reservation_id, ingredient, quantity) VALUES (?, ?, ?)',
  );
  const reservationById = db.prepare('SELECT * FROM inventory_stock_reservation WHERE id = ?');
  const reservationLines = db.prepare('SELECT ingredient, quantity FROM inventory_stock_reservation_line WHERE reservation_id = ?');
  const markReleased = db.prepare("UPDATE inventory_stock_reservation SET status = 'RELEASED' WHERE id = ?");

  // Tira do stock todos os ingredientes, ou nenhum: se faltar um, a transação é desfeita.
  function reserve(storeId: string, needs: StockLevel[]): ReservationResult {
    try {
      return transaction(db, () => {
        const reservationId = Number(insertReservation.run(storeId).lastInsertRowid);
        for (const { ingredient, quantity } of needs) {
          if (take.run(quantity, storeId, ingredient, quantity).changes !== 1) throw new OutOfStock(ingredient);
          insertReservationLine.run(reservationId, ingredient, quantity);
        }
        return { ok: true, reservationId };
      });
    } catch (err) {
      if (err instanceof OutOfStock) return { ok: false, ingredient: err.message };
      throw err;
    }
  }

  function release(reservationId: number): boolean {
    return transaction(db, () => {
      const reservation = reservationById.get(reservationId) as ReservationRow | undefined;
      if (!reservation || reservation.status !== 'ACTIVE') return false;
      for (const line of rowsOf<StockLevel>(reservationLines.all(reservationId))) {
        give.run(reservation.store_id, line.ingredient, line.quantity);
      }
      markReleased.run(reservationId);
      return true;
    });
  }

  return {
    findByStore: (storeId: string): StockLevel[] => rowsOf<StockLevel>(byStore.all(storeId)).map((r) => ({ ...r })),
    reserve,
    release,
    restock: (storeId: string, ingredient: string, quantity: number) => give.run(storeId, ingredient, quantity),
  };
}
