// Leitura do catálogo comum. As variações de cada loja vêm dos plug-ins, não da base de dados.
export function createCatalogRepository(db) {
  const allSandwiches = db.prepare('SELECT id, name, base_price_cents FROM checkout_sandwich ORDER BY name');

  return {
    findAllSandwiches: () =>
      allSandwiches.all().map((r) => ({ id: r.id, name: r.name, basePriceCents: r.base_price_cents })),
  };
}
