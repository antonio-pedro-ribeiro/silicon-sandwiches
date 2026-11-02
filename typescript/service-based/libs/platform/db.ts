// Biblioteca partilhada: ligação à base de dados partilhada (SQLite embutido no Node) e transações.
// Os serviços não criam tabelas: o esquema é gerido à parte (database/setup.ts).
import { DatabaseSync } from 'node:sqlite';

export type Database = DatabaseSync;

export function openDatabase(path: string): Database {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');   // vários processos (os serviços) na mesma base de dados
  db.exec('PRAGMA busy_timeout = 5000');  // se outro serviço estiver a escrever, espera até 5 s
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

// Transação síncrona. Usa SAVEPOINT, por isso pode correr dentro de outra transação
// (por exemplo, a reserva de stock dentro da transação do checkout).
let savepoints = 0;
export function transaction<T>(db: Database, work: () => T): T {
  const name = `sp${++savepoints}`;
  db.exec(`SAVEPOINT ${name}`);
  try {
    const result = work();
    db.exec(`RELEASE ${name}`);
    return result;
  } catch (err) {
    db.exec(`ROLLBACK TO ${name}`);
    db.exec(`RELEASE ${name}`);
    throw err;
  }
}

// Transação ACID que pode esperar por uma chamada assíncrona (o gateway de pagamento).
// Fica com o lock de escrita desde o início (BEGIN IMMEDIATE), e as transações desta ligação
// correm uma de cada vez: enquanto uma espera pelo pagamento, a seguinte aguarda na fila.
const queues = new WeakMap<Database, Promise<unknown>>();
export function transactionAsync<T>(db: Database, work: () => Promise<T>): Promise<T> {
  const run = (queues.get(db) ?? Promise.resolve()).then(async () => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = await work();
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  });
  queues.set(db, run.catch(() => {}));
  return run;
}

// O node:sqlite devolve linhas sem tipo: cada repositório declara as colunas que espera.
export const rowsOf = <Row>(rows: unknown[]): Row[] => rows as Row[];
