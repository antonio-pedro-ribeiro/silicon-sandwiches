// Registo de plug-ins do lado do núcleo: valida cada plug-in contra o contrato e indexa-os
// (lojas por storeId, promoções por código). Os módulos do núcleo procuram aqui o plug-in certo
// e chamam-no de forma genérica, sem nenhum "if (loja === 'porto')".
import { contractProblems } from './contracts.js';

export function createPluginHost(plugins) {
  const problems = plugins.flatMap(contractProblems);
  if (problems.length) throw new Error(`Plug-ins inválidos:\n  - ${problems.join('\n  - ')}`);

  const of = (contract) => plugins.filter((p) => p.contract === contract);
  const stores = new Map(of('store').map((p) => [p.storeId, p]));
  const promotions = new Map(of('promotion').map((p) => [p.code, p]));

  return {
    store: (storeId) => stores.get(storeId),
    promotion: (code) => promotions.get(code),
    promotions: () => [...promotions.values()].sort((a, b) => a.code.localeCompare(b.code)),
    list: () => plugins.map(({ name, contract, description }) => ({ name, contract, description })),
  };
}
