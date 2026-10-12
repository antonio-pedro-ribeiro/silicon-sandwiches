// Leitura do catálogo comum e das variações locais de cada loja.
export function createCatalogRepository(db) {
  const allSandwiches = db.prepare(
    'SELECT id, name, base_price_cents, local_only FROM checkout_sandwich ORDER BY name',
  );
  const storeOverrides = db.prepare(
    'SELECT sandwich_id, price_cents, available FROM checkout_store_menu WHERE store_id = ?',
  );

  return {
    findAllSandwiches: () =>
      allSandwiches.all().map((r) => ({
        id: r.id,
        name: r.name,
        basePriceCents: r.base_price_cents,
        localOnly: r.local_only === 1,
      })),

    findStoreOverrides: (storeId) =>
      storeOverrides.all(storeId).map((r) => ({
        sandwichId: r.sandwich_id,
        priceCents: r.price_cents,
        available: r.available === 1,
      })),
  };
}
