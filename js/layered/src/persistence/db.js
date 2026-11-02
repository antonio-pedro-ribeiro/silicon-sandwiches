// Camada de persistência: acesso à base de dados SQL (SQLite embutido no Node).
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Sobe quando o esquema muda: uma base de dados antiga é apagada e recriada com os dados de exemplo.
const SCHEMA_VERSION = 2;

const schema = readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../../database/seed.sql', import.meta.url), 'utf8');

export function openDatabase(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  resetIfOutdated(db);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(schema);
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM store').get();
  if (n === 0) db.exec(seed);
  return db;
}

function resetIfOutdated(db) {
  const { user_version: version } = db.prepare('PRAGMA user_version').get();
  if (version === SCHEMA_VERSION) return;
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
  if (tables.length) console.log(`Esquema da base de dados desatualizado: a recriar com os dados de exemplo.`);
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
