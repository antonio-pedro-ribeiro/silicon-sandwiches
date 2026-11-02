// Cria a base de dados partilhada (data/silicon-sandwiches.db) com os dados de exemplo, se ainda não existir.
// O npm start já o faz; é preciso à mão só para arrancar os serviços um a um.
import { fileURLToPath } from 'node:url';
import { setupDatabase } from '../database/setup.js';

const dbPath = process.env.DB_PATH ?? fileURLToPath(new URL('../data/silicon-sandwiches.db', import.meta.url));
setupDatabase(dbPath);
console.log(`Base de dados partilhada pronta: ${dbPath}`);
