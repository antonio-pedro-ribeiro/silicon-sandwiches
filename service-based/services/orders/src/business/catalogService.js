// Catálogo com personalização local: o menu de uma loja é o catálogo comum
// mais as variações locais (preço próprio, artigo indisponível, artigo exclusivo).
export function createCatalogService({ catalogRepository }) {
  function menuFor(storeId) {
    const overrides = new Map(
      catalogRepository.findStoreOverrides(storeId).map((o) => [o.sandwichId, o]),
    );
    return catalogRepository.findAllSandwiches().flatMap((sandwich) => {
      const local = overrides.get(sandwich.id);
      const available = local ? local.available : !sandwich.localOnly;
      if (!available) return [];
      return [{
        id: sandwich.id,
        name: sandwich.name,
        priceCents: local?.priceCents ?? sandwich.basePriceCents,
      }];
    });
  }

  return { menuFor };
}
