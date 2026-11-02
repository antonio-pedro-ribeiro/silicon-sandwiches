// Registo de plug-ins do lado do núcleo: valida cada plug-in contra o contrato e indexa-os
// (lojas por storeId, promoções por código). Os módulos do núcleo procuram aqui o plug-in certo
// e chamam-no de forma genérica, sem nenhum "if (loja === 'porto')".
import { contractProblems, isPlugin, type PromotionPlugin, type StorePlugin } from './contracts.ts';

export type PluginHost = ReturnType<typeof createPluginHost>;

// Os plug-ins chegam como `unknown`: só passam a Plugin depois de validados.
export function createPluginHost(candidates: readonly unknown[]) {
  const problems = candidates.flatMap(contractProblems);
  if (problems.length) throw new Error(`Plug-ins inválidos:\n  - ${problems.join('\n  - ')}`);
  const plugins = candidates.filter(isPlugin);

  const stores = new Map(plugins.filter((p): p is StorePlugin => p.contract === 'store').map((p) => [p.storeId, p]));
  const promotions = new Map(
    plugins.filter((p): p is PromotionPlugin => p.contract === 'promotion').map((p) => [p.code, p]),
  );

  return {
    store: (storeId: string): StorePlugin | undefined => stores.get(storeId),
    promotion: (code: string): PromotionPlugin | undefined => promotions.get(code),
    promotions: (): PromotionPlugin[] => [...promotions.values()].sort((a, b) => a.code.localeCompare(b.code)),
    list: () => plugins.map(({ name, contract, description }) => ({ name, contract, description })),
  };
}
