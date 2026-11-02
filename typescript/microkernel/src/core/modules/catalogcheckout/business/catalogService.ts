// Catálogo: o núcleo só conhece o catálogo comum (o caminho feliz). A personalização local
// (preço próprio, artigo indisponível, artigo exclusivo) está no plug-in da loja, se existir.
import type { PluginHost } from '../../../plugins/pluginHost.ts';
import type { MenuItem } from '../../../plugins/contracts.ts';
import type { CatalogRepository } from '../persistence/catalogRepository.ts';

export type { MenuItem };

export type CatalogService = ReturnType<typeof createCatalogService>;

export function createCatalogService(
  { catalogRepository, plugins }: { catalogRepository: CatalogRepository; plugins: Pick<PluginHost, 'store'> },
) {
  function menuFor(storeId: string): MenuItem[] {
    const common = catalogRepository.findAllSandwiches().map(({ id, name, basePriceCents }) => ({
      id, name, priceCents: basePriceCents,
    }));
    const local = plugins.store(storeId);
    const menu = local ? local.menu(common) : common;
    return [...menu].sort((a, b) => a.name.localeCompare(b.name));
  }

  return { menuFor };
}
