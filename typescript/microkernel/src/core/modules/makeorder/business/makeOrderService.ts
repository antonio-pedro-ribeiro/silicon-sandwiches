// MakeOrder: um bilhete de cozinha por encomenda, que avança QUEUED → PREPARING → READY → COLLECTED.
import { NotFoundError, ValidationError } from '../../../shared/errors.ts';
import type { KitchenRepository, KitchenTicket, TicketStatus } from '../persistence/kitchenRepository.ts';

const NEXT: Partial<Record<TicketStatus, TicketStatus>> = { QUEUED: 'PREPARING', PREPARING: 'READY', READY: 'COLLECTED' };

// Da encomenda, a cozinha só precisa do número, da loja e do que há para fazer.
export interface OrderToMake {
  id: number;
  storeId: string;
  lines: { name: string; quantity: number }[];
}

export type MakeOrderService = ReturnType<typeof createMakeOrderService>;

export function createMakeOrderService({ kitchenRepository }: { kitchenRepository: KitchenRepository }) {
  return {
    async enqueue(order: OrderToMake): Promise<KitchenTicket> {
      return kitchenRepository.create({
        orderId: order.id,
        storeId: order.storeId,
        items: order.lines.map((l) => ({ name: l.name, quantity: l.quantity })),
      });
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
