// Limpa a base de dados do Delivery (data/delivery.db): apaga as entregas e mantém as zonas.
// Com o serviço parado: npm run reset:db
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDatabase, transaction } from '../src/shared/db.js';

const dbPath = process.env.DB_PATH ?? fileURLToPath(new URL('../data/delivery.db', import.meta.url));
if (!existsSync(dbPath)) {
  console.log(`Não existe base de dados em ${dbPath}: nada a limpar.`);
  process.exit(0);
}

const db = openDatabase(dbPath);
transaction(db, () => {
  const { changes } = db.prepare('DELETE FROM delivery_job').run();
  console.log(`delivery · delivery_job: ${changes} linha(s) apagada(s)`);
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'delivery_job'").run();
});
db.close();
console.log(`Base de dados limpa (zonas mantidas): ${dbPath}`);
