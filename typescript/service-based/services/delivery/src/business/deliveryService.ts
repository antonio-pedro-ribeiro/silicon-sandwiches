// Entregas: cada uma avança SCHEDULED → OUT_FOR_DELIVERY → DELIVERED.
// As entregas são criadas pelo serviço Orders, na mesma transação da encomenda (partição delivery).
import { NotFoundError, ValidationError } from '../../../../libs/platform/errors.ts';
import type { DeliveryJob, DeliveryRepository, DeliveryStatus } from '../../../../libs/delivery-entities/index.ts';

const NEXT: Partial<Record<DeliveryStatus, DeliveryStatus>> = { SCHEDULED: 'OUT_FOR_DELIVERY', OUT_FOR_DELIVERY: 'DELIVERED' };

export type DeliveryService = ReturnType<typeof createDeliveryService>;

export function createDeliveryService({ deliveryRepository }: { deliveryRepository: DeliveryRepository }) {
  return {
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
