// MakeOrder: um bilhete de cozinha por encomenda, que avança QUEUED → PREPARING → READY → COLLECTED.
import { NotFoundError, ValidationError } from '../../../shared/errors.js';

const NEXT = { QUEUED: 'PREPARING', PREPARING: 'READY', READY: 'COLLECTED' };

export function createMakeOrderService({ kitchenRepository }) {
  return {
    async enqueue(order) {
      return kitchenRepository.create({
        orderId: order.id,
        storeId: order.storeId,
        items: order.lines.map((l) => ({ name: l.name, quantity: l.quantity })),
      });
    },
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
