// Plug-in de promoção PORTO15: 15%, só na loja dos Aliados.
export default {
  name: 'promotion/porto15',
  contract: 'promotion',
  code: 'PORTO15',
  description: '15% só na loja dos Aliados',
  evaluate({ storeId, subtotalCents }) {
    if (storeId !== 'porto-aliados') return { valid: false, reason: 'PORTO15 não é válido nesta loja' };
    return { valid: true, discountCents: Math.round((subtotalCents * 15) / 100) };
  },
};
