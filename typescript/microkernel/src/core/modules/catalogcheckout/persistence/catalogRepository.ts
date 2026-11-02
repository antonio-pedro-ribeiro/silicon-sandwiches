// Leitura do catálogo comum. As variações de cada loja vêm dos plug-ins, não da base de dados.
import { rowsOf, type Database } from '../../../shared/db.ts';

export interface Sandwich {
  id: string;
  name: string;
  basePriceCents: number;
}

interface SandwichRow { id: string; name: string; base_price_cents: number }

export type CatalogRepository = ReturnType<typeof createCatalogRepository>;

export function createCatalogRepository(db: Database) {
  const allSandwiches = db.prepare('SELECT id, name, base_price_cents FROM checkout_sandwich ORDER BY name');

  return {
    findAllSandwiches: (): Sandwich[] =>
      rowsOf<SandwichRow>(allSandwiches.all()).map((r) => ({ id: r.id, name: r.name, basePriceCents: r.base_price_cents })),
  };
}
