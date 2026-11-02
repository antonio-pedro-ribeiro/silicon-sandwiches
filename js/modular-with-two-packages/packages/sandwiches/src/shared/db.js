// Biblioteca partilhada: abre a base de dados SQL (SQLite embutido no Node).
// Uma base de dados para os módulos deste pacote; cada módulo cria e é dono das suas tabelas.
// O Delivery, noutro pacote, tem a sua própria base de dados.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Sobe quando o esquema muda: uma base de dados antiga é apagada e recriada com os dados de exemplo.
const SCHEMA_VERSION = 2;

export function openDatabase(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  resetIfOutdated(db);
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

// Cria as tabelas de um módulo (persistence/schema.sql) e, se estiverem vazias, carrega persistence/seed.sql.
export function migrateModule(db, persistenceDir, probeTable) {
  db.exec(readFileSync(new URL('schema.sql', persistenceDir), 'utf8'));
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM ${probeTable}`).get();
  if (n === 0) db.exec(readFileSync(new URL('seed.sql', persistenceDir), 'utf8'));
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
