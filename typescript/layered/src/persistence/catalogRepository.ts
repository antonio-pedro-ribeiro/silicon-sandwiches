// Leitura do catálogo comum e das variações locais de cada loja.
import { rowsOf, type Database } from './db.ts';

export interface Sandwich {
  id: string;
  name: string;
  basePriceCents: number;
  localOnly: boolean;
}

export interface StoreOverride {
  sandwichId: string;
  priceCents: number | null;
  available: boolean;
}

interface SandwichRow { id: string; name: string; base_price_cents: number; local_only: number }
interface StoreMenuRow { sandwich_id: string; price_cents: number | null; available: number }

export type CatalogRepository = ReturnType<typeof createCatalogRepository>;

export function createCatalogRepository(db: Database) {
  const allSandwiches = db.prepare(
    'SELECT id, name, base_price_cents, local_only FROM sandwich ORDER BY name',
  );
  const storeOverrides = db.prepare(
    'SELECT sandwich_id, price_cents, available FROM store_menu WHERE store_id = ?',
  );

  return {
    findAllSandwiches: (): Sandwich[] =>
      rowsOf<SandwichRow>(allSandwiches.all()).map((r) => ({
        id: r.id,
        name: r.name,
        basePriceCents: r.base_price_cents,
        localOnly: r.local_only === 1,
      })),

    findStoreOverrides: (storeId: string): StoreOverride[] =>
      rowsOf<StoreMenuRow>(storeOverrides.all(storeId)).map((r) => ({
        sandwichId: r.sandwich_id,
        priceCents: r.price_cents,
        available: r.available === 1,
      })),
  };
}
