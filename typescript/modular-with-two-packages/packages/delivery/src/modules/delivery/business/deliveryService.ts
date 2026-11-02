// Delivery: taxa e tempo por loja; cada entrega avança SCHEDULED → OUT_FOR_DELIVERY → DELIVERED.
import { NotFoundError, ValidationError } from '../../../shared/errors.ts';
import type { DeliveryJob, DeliveryRepository, DeliveryStatus } from '../persistence/deliveryRepository.ts';

const NEXT: Partial<Record<DeliveryStatus, DeliveryStatus>> = { SCHEDULED: 'OUT_FOR_DELIVERY', OUT_FOR_DELIVERY: 'DELIVERED' };

export type DeliveryQuote =
  | { available: true; feeCents: number; etaMinutes: number }
  | { available: false; reason: string };

export type DeliveryService = ReturnType<typeof createDeliveryService>;

export function createDeliveryService({ deliveryRepository }: { deliveryRepository: DeliveryRepository }) {
  return {
    async quote({ store }: { store: { id: string; name: string }; address?: string }): Promise<DeliveryQuote> {
      const zone = deliveryRepository.findZone(store.id);
      if (!zone) return { available: false, reason: `A loja ${store.name} não faz entregas` };
      return { available: true, feeCents: zone.feeCents, etaMinutes: zone.etaMinutes };
    },
    async schedule({ order, address }: { order: { id: number; storeId: string }; address: string }): Promise<DeliveryJob> {
      const zone = deliveryRepository.findZone(order.storeId);
      if (!zone) throw new ValidationError(`A loja ${order.storeId} não faz entregas`);
      return deliveryRepository.create({
        orderId: order.id,
        storeId: order.storeId,
        address,
        etaMinutes: zone.etaMinutes,
      });
    },
    async list(): Promise<DeliveryJob[]> {
      return deliveryRepository.findAll();
    },
    async advance(id: number): Promise<DeliveryJob> {
      const job = deliveryRepository.findById(id);
      if (!job) throw new NotFoundError(`Entrega ${id} não existe`);
      const next = NEXT[job.status];
      if (!next) throw new ValidationError(`A entrega ${id} já foi concluída`);
      deliveryRepository.setStatus(id, next);
      return deliveryRepository.findById(id)!;
    },
  };
}
