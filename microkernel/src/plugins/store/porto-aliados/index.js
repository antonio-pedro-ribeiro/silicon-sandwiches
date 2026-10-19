// Plug-in da loja Porto · Aliados: tem a francesinha (exclusiva, com preço local) e faz entregas.
export default {
  name: 'store/porto-aliados',
  contract: 'store',
  storeId: 'porto-aliados',
  description: 'Francesinha exclusiva a 6,50 €; entregas a 2,50 € (30 min)',
  menu: (common) => [...common, { id: 'francesinha', name: 'Francesinha em sandes', priceCents: 650 }],
  delivery: { feeCents: 250, etaMinutes: 30 },
};
