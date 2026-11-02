// Plug-in da loja Lisboa · Campo Grande: a bifana é mais cara, o prego não se vende e faz entregas.
export default {
  name: 'store/lisboa-campo-grande',
  contract: 'store',
  storeId: 'lisboa-campo-grande',
  description: 'Bifana a 4,80 €; sem prego; entregas a 3,00 € (35 min)',
  menu: (common) => common
    .filter((item) => item.id !== 'prego')
    .map((item) => (item.id === 'bifana' ? { ...item, priceCents: 480 } : item)),
  delivery: { feeCents: 300, etaMinutes: 35 },
};
