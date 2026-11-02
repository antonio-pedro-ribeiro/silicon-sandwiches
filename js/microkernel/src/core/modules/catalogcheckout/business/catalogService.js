// Catálogo: o núcleo só conhece o catálogo comum (o caminho feliz). A personalização local
// (preço próprio, artigo indisponível, artigo exclusivo) está no plug-in da loja, se existir.
export function createCatalogService({ catalogRepository, plugins }) {
  function menuFor(storeId) {
    const common = catalogRepository.findAllSandwiches().map(({ id, name, basePriceCents }) => ({
      id, name, priceCents: basePriceCents,
    }));
    const local = plugins.store(storeId);
    const menu = local ? local.menu(common) : common;
    return [...menu].sort((a, b) => a.name.localeCompare(b.name));
  }

  return { menuFor };
}
