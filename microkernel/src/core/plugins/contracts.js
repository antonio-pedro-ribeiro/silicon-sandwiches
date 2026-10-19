// Contratos dos plug-ins: o núcleo só conhece isto. Não sabe que lojas ou códigos existem,
// nem como cada um decide; chama o plug-in pelo contrato e usa a resposta.
//
// store · personalização de uma loja (um plug-in por loja; uma loja sem plug-in usa só o caminho feliz)
//   storeId      'porto-aliados'
//   description  texto para a interface
//   menu(common) recebe o menu comum [{ id, name, priceCents }] e devolve o menu desta loja
//   delivery     { feeCents, etaMinutes } se a loja faz entregas; omitido se não faz
//
// promotion · um código promocional (um plug-in por código)
//   code         'FCUL10'
//   description  texto para a interface
//   evaluate(ctx) ctx = { storeId, customerId, subtotalCents, timesUsed }
//                devolve { valid: true, discountCents } ou { valid: false, reason }
//                timesUsed (quantas vezes o cliente já usou o código) é lido pelo núcleo:
//                o plug-in não acede à base de dados.
//
// Todos os plug-ins têm ainda name ('<contrato>/<contexto>') e contract ('store' ou 'promotion').
export const CONTRACTS = {
  store: { storeId: 'string', description: 'string', menu: 'function' },
  promotion: { code: 'string', description: 'string', evaluate: 'function' },
};

// Devolve a lista de problemas (vazia se o plug-in cumpre o contrato).
export function contractProblems(plugin) {
  if (typeof plugin?.name !== 'string') return ['falta name'];
  const fields = CONTRACTS[plugin.contract];
  if (!fields) return [`${plugin.name}: contrato desconhecido "${plugin.contract}"`];
  const problems = Object.entries(fields)
    .filter(([field, type]) => typeof plugin[field] !== type)
    .map(([field, type]) => `${plugin.name}: ${field} tem de ser ${type}`);
  const { delivery } = plugin;
  if (plugin.contract === 'store' && delivery !== undefined
    && !(Number.isInteger(delivery?.feeCents) && Number.isInteger(delivery?.etaMinutes))) {
    problems.push(`${plugin.name}: delivery tem de ter feeCents e etaMinutes inteiros`);
  }
  return problems;
}
