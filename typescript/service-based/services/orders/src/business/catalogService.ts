// Catálogo com personalização local: o menu de uma loja é o catálogo comum
// mais as variações locais (preço próprio, artigo indisponível, artigo exclusivo).
import type { CatalogRepository } from '../../../../libs/orders-entities/index.ts';

export interface MenuItem {
  id: string;
  name: string;
  priceCents: number;
}

export type CatalogService = ReturnType<typeof createCatalogService>;

export function createCatalogService({ catalogRepository }: { catalogRepository: CatalogRepository }) {
  function menuFor(storeId: string): MenuItem[] {
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
