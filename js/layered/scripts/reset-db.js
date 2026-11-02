// Limpa a base de dados do servidor (data/silicon-sandwiches.db), mantendo só os dados de catálogo:
// lojas, sandes, menus locais, receitas, stocks, códigos promocionais e zonas de entrega.
// Apaga tudo o que os checkouts criaram (encomendas, reservas, utilizações de códigos, bilhetes, entregas)
// e devolve ao stock o que as reservas ativas tinham tirado.
// Com o servidor parado: npm run reset:db
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDatabase, transaction } from '../src/persistence/db.js';

const dbPath = process.env.DB_PATH ?? fileURLToPath(new URL('../data/silicon-sandwiches.db', import.meta.url));
if (!existsSync(dbPath)) {
  console.log(`Não existe base de dados em ${dbPath}: nada a limpar.`);
  process.exit(0);
}

// Filhas antes das mães, por causa das chaves estrangeiras entre componentes.
const TRANSACTIONAL = [
  'delivery_job',
  'kitchen_ticket_item',
  'kitchen_ticket',
  'promotion_redemption',
  'stock_reservation_line',
  'stock_reservation',
  'order_line',
  'customer_order',
];

const db = openDatabase(dbPath);
transaction(db, () => {
  db.exec(`
    UPDATE stock_level SET quantity = quantity + (
      SELECT SUM(l.quantity) FROM stock_reservation_line l JOIN stock_reservation r ON r.id = l.reservation_id
      WHERE r.status = 'ACTIVE' AND r.store_id = stock_level.store_id AND l.ingredient = stock_level.ingredient)
    WHERE EXISTS (
      SELECT 1 FROM stock_reservation_line l JOIN stock_reservation r ON r.id = l.reservation_id
      WHERE r.status = 'ACTIVE' AND r.store_id = stock_level.store_id AND l.ingredient = stock_level.ingredient)`);
  for (const table of TRANSACTIONAL) {
    const { changes } = db.prepare(`DELETE FROM ${table}`).run();
    console.log(`${table}: ${changes} linha(s) apagada(s)`);
  }
  // Os números das encomendas, bilhetes, … voltam a começar em 1.
  db.prepare(`DELETE FROM sqlite_sequence WHERE name IN (${TRANSACTIONAL.map(() => '?').join(', ')})`).run(...TRANSACTIONAL);
});
db.close();
console.log(`Base de dados limpa (catálogo mantido): ${dbPath}`);
