// MOCK · gateway de pagamento externo. Recusa o cliente "sem-saldo" para se poder mostrar o erro.
import { randomUUID } from 'node:crypto';
import { mockLog } from './mockLog.js';

export function createPaymentService() {
  return {
    async charge({ customerId, amountCents }) {
      if (customerId === 'sem-saldo') {
        mockLog('Payment', `recusado o pagamento de ${amountCents} cêntimos`);
        return { approved: false, reason: 'Pagamento recusado pelo banco' };
      }
      const ref = `PAY-${randomUUID().slice(0, 8).toUpperCase()}`;
      mockLog('Payment', `cobrados ${amountCents} cêntimos a ${customerId} (${ref})`);
      return { approved: true, ref };
    },
  };
}
