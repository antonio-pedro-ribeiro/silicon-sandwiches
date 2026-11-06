// Kitchen (MakeOrder): um bilhete de cozinha por encomenda, que avança QUEUED → PREPARING → READY → COLLECTED.
import { NotFoundError, ValidationError } from '../../../../platform/errors.ts';
import type { KitchenRepository, KitchenTicket, NewTicket, TicketStatus } from '../persistence/kitchenRepository.ts';

const NEXT: Partial<Record<TicketStatus, TicketStatus>> = { QUEUED: 'PREPARING', PREPARING: 'READY', READY: 'COLLECTED' };

export type MakeOrderService = ReturnType<typeof createMakeOrderService>;

export function createMakeOrderService({ kitchenRepository }: { kitchenRepository: KitchenRepository }) {
  return {
    // Reação ao evento OrderPlaced. O mesmo evento pode chegar mais de uma vez: um só bilhete por encomenda.
    async enqueue({ orderId, storeId, items }: NewTicket): Promise<KitchenTicket> {
      return kitchenRepository.findByOrder(orderId) ?? kitchenRepository.create({ orderId, storeId, items });
    },
    async getQueue(storeId?: string | null): Promise<KitchenTicket[]> {
      return kitchenRepository.findAll(storeId);
    },
    async advance(ticketId: number): Promise<KitchenTicket> {
      const ticket = kitchenRepository.findById(ticketId);
      if (!ticket) throw new NotFoundError(`Bilhete ${ticketId} não existe`);
      const next = NEXT[ticket.status];
      if (!next) throw new ValidationError(`O bilhete ${ticketId} já foi levantado`);
      kitchenRepository.setStatus(ticketId, next);
      return kitchenRepository.findById(ticketId)!;
    },
  };
}
