// Plataforma · base de dados de UM serviço (database-per-service). Cada serviço abre o seu ficheiro,
// cria as suas tabelas (persistence/schema.sql) e, se estiverem vazias, carrega persistence/seed.sql.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Sobe quando o esquema muda: uma base de dados antiga é apagada e recriada com os dados de exemplo.
const SCHEMA_VERSION = 1;

export function openDatabase(path, persistenceDir) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  resetIfOutdated(db);
  db.exec('PRAGMA foreign_keys = ON');
  const sql = (file) => readFileSync(new URL(file, persistenceDir), 'utf8');
  const schema = sql('schema.sql');
  db.exec(schema);
  const firstTable = schema.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
  if (db.prepare(`SELECT COUNT(*) AS n FROM ${firstTable}`).get().n === 0) db.exec(sql('seed.sql'));
  return db;
}

function resetIfOutdated(db) {
  const { user_version: version } = db.prepare('PRAGMA user_version').get();
  if (version === SCHEMA_VERSION) return;
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
  if (tables.length) console.log('Esquema da base de dados desatualizado: a recriar com os dados de exemplo.');
  db.exec('PRAGMA foreign_keys = OFF');
  for (const { name } of tables) db.exec(`DROP TABLE "${name}"`);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

export function transaction(db, work) {
  db.exec('BEGIN');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
