// Cozinha: fila de bilhetes, que avançam QUEUED → PREPARING → READY → COLLECTED.
// Os bilhetes são criados pelo serviço Orders, na mesma transação da encomenda (partição kitchen).
import { NotFoundError, ValidationError } from '../../../../libs/platform/errors.ts';
import type { KitchenRepository, KitchenTicket, TicketStatus } from '../../../../libs/kitchen-entities/index.ts';

const NEXT: Partial<Record<TicketStatus, TicketStatus>> = { QUEUED: 'PREPARING', PREPARING: 'READY', READY: 'COLLECTED' };

export type MakeOrderService = ReturnType<typeof createMakeOrderService>;

export function createMakeOrderService({ kitchenRepository }: { kitchenRepository: KitchenRepository }) {
  return {
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
