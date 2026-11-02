// Contratos dos plug-ins: o núcleo só conhece isto. Não sabe que lojas ou códigos existem,
// nem como cada um decide; chama o plug-in pelo contrato e usa a resposta.
// Em TypeScript o contrato tem duas faces: as interfaces abaixo (verificadas pelo tsc, e que os
// plug-ins podem importar com `import type`, que desaparece em tempo de execução) e
// contractProblems, que valida no arranque os plug-ins que chegam de fora.

export interface MenuItem {
  id: string;
  name: string;
  priceCents: number;
}

// store · personalização de uma loja (um plug-in por loja; uma loja sem plug-in usa só o caminho feliz)
export interface StorePlugin {
  name: string;                               // 'store/porto-aliados'
  contract: 'store';
  storeId: string;                            // 'porto-aliados'
  description: string;                        // texto para a interface
  menu(common: MenuItem[]): MenuItem[];       // recebe o menu comum e devolve o menu desta loja
  delivery?: { feeCents: number; etaMinutes: number }; // omitido se a loja não faz entregas
}

// promotion · um código promocional (um plug-in por código)
// timesUsed (quantas vezes o cliente já usou o código) é lido pelo núcleo: o plug-in não acede à base de dados.
export interface PromotionContext {
  storeId: string;
  customerId: string;
  subtotalCents: number;
  timesUsed: number;
}

export type PromotionResult = { valid: true; discountCents: number } | { valid: false; reason: string };

export interface PromotionPlugin {
  name: string;                               // 'promotion/fcul10'
  contract: 'promotion';
  code: string;                               // 'FCUL10'
  description: string;                        // texto para a interface
  evaluate(ctx: PromotionContext): PromotionResult;
}

export type Plugin = StorePlugin | PromotionPlugin;

export const CONTRACTS: Record<Plugin['contract'], Record<string, string>> = {
  store: { storeId: 'string', description: 'string', menu: 'function' },
  promotion: { code: 'string', description: 'string', evaluate: 'function' },
};

// Devolve a lista de problemas (vazia se o plug-in cumpre o contrato).
export function contractProblems(candidate: unknown): string[] {
  const plugin = (candidate ?? {}) as Record<string, unknown>;
  if (typeof plugin.name !== 'string') return ['falta name'];
  const fields = CONTRACTS[plugin.contract as Plugin['contract']];
  if (!fields) return [`${plugin.name}: contrato desconhecido "${plugin.contract}"`];
  const problems = Object.entries(fields)
    .filter(([field, type]) => typeof plugin[field] !== type)
    .map(([field, type]) => `${plugin.name}: ${field} tem de ser ${type}`);
  const delivery = plugin.delivery as { feeCents?: unknown; etaMinutes?: unknown } | undefined;
  if (plugin.contract === 'store' && delivery !== undefined
    && !(Number.isInteger(delivery?.feeCents) && Number.isInteger(delivery?.etaMinutes))) {
    problems.push(`${plugin.name}: delivery tem de ter feeCents e etaMinutes inteiros`);
  }
  return problems;
}

export function isPlugin(candidate: unknown): candidate is Plugin {
  return contractProblems(candidate).length === 0;
}
