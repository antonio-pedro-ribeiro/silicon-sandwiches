// A base de dados partilhada: uma só base de dados física, dividida em partições lógicas
// (common, orders, inventory, kitchen, delivery), cada uma com o seu schema.sql e a sua biblioteca
// de entidades (libs/<partição>-entities). Gerida à parte dos serviços (a "equipa de dados"):
// cria as tabelas que faltam e carrega os dados de exemplo das partições vazias.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const PARTITIONS = ['common', 'orders', 'inventory', 'kitchen', 'delivery'];

// Sobe quando o esquema muda: uma base de dados antiga é apagada e recriada com os dados de exemplo.
const SCHEMA_VERSION = 1;

export function setupDatabase(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  resetIfOutdated(db);
  for (const partition of PARTITIONS) {
    const sql = (file) => readFileSync(new URL(`./${partition}/${file}`, import.meta.url), 'utf8');
    const schema = sql('schema.sql');
    const firstTable = schema.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
    db.exec(schema);
    if (db.prepare(`SELECT COUNT(*) AS n FROM ${firstTable}`).get().n === 0) db.exec(sql('seed.sql'));
  }
  db.close();
}

function resetIfOutdated(db) {
  const { user_version: version } = db.prepare('PRAGMA user_version').get();
  if (version === SCHEMA_VERSION) return;
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
  if (tables.length) console.log('Esquema da base de dados desatualizado: a recriar com os dados de exemplo.');
  for (const { name } of tables) db.exec(`DROP TABLE "${name}"`);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
