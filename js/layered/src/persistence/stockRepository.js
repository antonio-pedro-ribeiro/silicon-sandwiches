// Stock de ingredientes por loja e reservas. Reservar e libertar são transações SQL.
import { transaction } from './db.js';

class OutOfStock extends Error {}

export function createStockRepository(db) {
  const byStore = db.prepare('SELECT ingredient, quantity FROM stock_level WHERE store_id = ? ORDER BY ingredient');
  const take = db.prepare(
    'UPDATE stock_level SET quantity = quantity - ? WHERE store_id = ? AND ingredient = ? AND quantity >= ?',
  );
  const give = db.prepare(`
    INSERT INTO stock_level (store_id, ingredient, quantity) VALUES (?, ?, ?)
    ON CONFLICT (store_id, ingredient) DO UPDATE SET quantity = quantity + excluded.quantity`);
  const insertReservation = db.prepare("INSERT INTO stock_reservation (store_id, status) VALUES (?, 'ACTIVE')");
  const insertReservationLine = db.prepare(
    'INSERT INTO stock_reservation_line (reservation_id, ingredient, quantity) VALUES (?, ?, ?)',
  );
  const reservationById = db.prepare('SELECT * FROM stock_reservation WHERE id = ?');
  const reservationLines = db.prepare('SELECT ingredient, quantity FROM stock_reservation_line WHERE reservation_id = ?');
  const markReleased = db.prepare("UPDATE stock_reservation SET status = 'RELEASED' WHERE id = ?");

  // Tira do stock todos os ingredientes, ou nenhum: se faltar um, a transação é desfeita.
  function reserve(storeId, needs) {
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

  function release(reservationId) {
    return transaction(db, () => {
      const reservation = reservationById.get(reservationId);
      if (!reservation || reservation.status !== 'ACTIVE') return false;
      for (const line of reservationLines.all(reservationId)) give.run(reservation.store_id, line.ingredient, line.quantity);
      markReleased.run(reservationId);
      return true;
    });
  }

  return {
    findByStore: (storeId) => byStore.all(storeId).map((r) => ({ ...r })),
    reserve,
    release,
    restock: (storeId, ingredient, quantity) => give.run(storeId, ingredient, quantity),
  };
}
