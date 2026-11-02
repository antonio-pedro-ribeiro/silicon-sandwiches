// Plug-in de promoção MENOS1: 1 € de desconto, só a partir de 10 €.
import type { PromotionPlugin } from '../../../core/plugins/contracts.ts';

export default {
  name: 'promotion/menos1',
  contract: 'promotion',
  code: 'MENOS1',
  description: '1 € de desconto acima de 10 €',
  evaluate({ subtotalCents }) {
    if (subtotalCents < 1000) return { valid: false, reason: 'MENOS1 só se aplica a partir de 10 €' };
    return { valid: true, discountCents: Math.min(100, subtotalCents) };
  },
} satisfies PromotionPlugin;
