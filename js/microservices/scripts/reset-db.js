// Limpa as bases de dados dos serviços (data/<serviço>.db), mantendo só os dados de catálogo:
// lojas, sandes, menus locais, receitas, stocks, códigos promocionais e zonas de entrega.
// Apaga tudo o que os checkouts criaram e devolve ao stock o que as reservas ativas tinham tirado.
// Cada serviço é dono da sua base de dados, por isso cada uma é limpa à parte.
// Com os serviços parados: npm run reset:db
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

// Tabelas transacionais de cada serviço (filhas antes das mães).
const TRANSACTIONAL = {
  checkout: ['checkout_order_line', 'checkout_customer_order', 'checkout_outbox'],
  inventory: ['inventory_stock_reservation_line', 'inventory_stock_reservation'],
  promotion: ['promotion_redemption'],
  kitchen: ['kitchen_ticket_item', 'kitchen_ticket'],
  delivery: ['delivery_job'],
};

for (const [service, tables] of Object.entries(TRANSACTIONAL)) {
  const dbPath = fileURLToPath(new URL(`../data/${service}.db`, import.meta.url));
  if (!existsSync(dbPath)) {
    console.log(`${service}: não existe ${dbPath}, nada a limpar.`);
    continue;
  }
  const db = new DatabaseSync(dbPath);
  db.exec('BEGIN');
  if (service === 'inventory') {
    db.exec(`
      UPDATE inventory_stock_level SET quantity = quantity + (
        SELECT SUM(l.quantity) FROM inventory_stock_reservation_line l
        JOIN inventory_stock_reservation r ON r.id = l.reservation_id
        WHERE r.status = 'ACTIVE' AND r.store_id = inventory_stock_level.store_id
          AND l.ingredient = inventory_stock_level.ingredient)
      WHERE EXISTS (
        SELECT 1 FROM inventory_stock_reservation_line l
        JOIN inventory_stock_reservation r ON r.id = l.reservation_id
        WHERE r.status = 'ACTIVE' AND r.store_id = inventory_stock_level.store_id
          AND l.ingredient = inventory_stock_level.ingredient)`);
  }
  for (const table of tables) {
    const { changes } = db.prepare(`DELETE FROM ${table}`).run();
    console.log(`${service} · ${table}: ${changes} linha(s) apagada(s)`);
  }
  db.prepare(`DELETE FROM sqlite_sequence WHERE name IN (${tables.map(() => '?').join(', ')})`).run(...tables);
  db.exec('COMMIT');
  db.close();
}
console.log('Bases de dados limpas (catálogo mantido).');
