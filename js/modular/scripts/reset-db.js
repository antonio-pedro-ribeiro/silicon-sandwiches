// Limpa a base de dados do servidor (data/silicon-sandwiches.db), mantendo só os dados de catálogo:
// lojas, sandes, menus locais, receitas, stocks, códigos promocionais e zonas de entrega.
// Apaga tudo o que os checkouts criaram (encomendas, reservas, utilizações de códigos, bilhetes, entregas)
// e devolve ao stock o que as reservas ativas tinham tirado.
// Com o servidor parado: npm run reset:db
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDatabase, transaction } from '../src/shared/db.js';

const dbPath = process.env.DB_PATH ?? fileURLToPath(new URL('../data/silicon-sandwiches.db', import.meta.url));
if (!existsSync(dbPath)) {
  console.log(`Não existe base de dados em ${dbPath}: nada a limpar.`);
  process.exit(0);
}

// Tabelas transacionais, agrupadas pelo módulo que é dono delas (filhas antes das mães).
const TRANSACTIONAL = {
  catalogcheckout: ['checkout_order_line', 'checkout_customer_order'],
  manageinventory: ['inventory_stock_reservation_line', 'inventory_stock_reservation'],
  promotion: ['promotion_redemption'],
  makeorder: ['kitchen_ticket_item', 'kitchen_ticket'],
  delivery: ['delivery_job'],
};
const tables = Object.values(TRANSACTIONAL).flat();

const db = openDatabase(dbPath);
transaction(db, () => {
  // ManageInventory: devolve ao stock o que as reservas ativas tinham tirado.
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
  for (const [module, owned] of Object.entries(TRANSACTIONAL)) {
    for (const table of owned) {
      const { changes } = db.prepare(`DELETE FROM ${table}`).run();
      console.log(`${module} · ${table}: ${changes} linha(s) apagada(s)`);
    }
  }
  // Os números das encomendas, bilhetes, … voltam a começar em 1.
  db.prepare(`DELETE FROM sqlite_sequence WHERE name IN (${tables.map(() => '?').join(', ')})`).run(...tables);
});
db.close();
console.log(`Base de dados limpa (catálogo mantido): ${dbPath}`);
