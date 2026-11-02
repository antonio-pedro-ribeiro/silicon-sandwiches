// Plug-in de promoção BEMVINDO: 2 € na primeira encomenda (a partir de 5 €), uma vez por cliente.
// Não conta as utilizações: recebe-as do núcleo em timesUsed.
import type { PromotionPlugin } from '../../../core/plugins/contracts.ts';

export default {
  name: 'promotion/bemvindo',
  contract: 'promotion',
  code: 'BEMVINDO',
  description: '2 € na primeira encomenda',
  evaluate({ customerId, subtotalCents, timesUsed }) {
    if (subtotalCents < 500) return { valid: false, reason: 'BEMVINDO só se aplica a partir de 5 €' };
    if (timesUsed >= 1) return { valid: false, reason: `${customerId} já usou o código BEMVINDO` };
    return { valid: true, discountCents: Math.min(200, subtotalCents) };
  },
} satisfies PromotionPlugin;
