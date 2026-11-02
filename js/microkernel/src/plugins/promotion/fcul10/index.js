// Plug-in de promoção FCUL10: 10% em todas as lojas, sem limite.
export default {
  name: 'promotion/fcul10',
  contract: 'promotion',
  code: 'FCUL10',
  description: '10% para a comunidade FCUL',
  evaluate: ({ subtotalCents }) => ({ valid: true, discountCents: Math.round((subtotalCents * 10) / 100) }),
};
