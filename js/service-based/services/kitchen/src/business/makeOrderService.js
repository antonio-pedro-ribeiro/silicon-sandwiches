// Cozinha: fila de bilhetes, que avançam QUEUED → PREPARING → READY → COLLECTED.
// Os bilhetes são criados pelo serviço Orders, na mesma transação da encomenda (partição kitchen).
import { NotFoundError, ValidationError } from '../../../../libs/platform/errors.js';

const NEXT = { QUEUED: 'PREPARING', PREPARING: 'READY', READY: 'COLLECTED' };

export function createMakeOrderService({ kitchenRepository }) {
  return {
    async getQueue(storeId) {
      return kitchenRepository.findAll(storeId);
    },
    async advance(ticketId) {
      const ticket = kitchenRepository.findById(ticketId);
      if (!ticket) throw new NotFoundError(`Bilhete ${ticketId} não existe`);
      const next = NEXT[ticket.status];
      if (!next) throw new ValidationError(`O bilhete ${ticketId} já foi levantado`);
      kitchenRepository.setStatus(ticketId, next);
      return kitchenRepository.findById(ticketId);
    },
  };
}
