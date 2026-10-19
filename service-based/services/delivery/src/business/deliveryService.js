// Entregas: cada uma avança SCHEDULED → OUT_FOR_DELIVERY → DELIVERED.
// As entregas são criadas pelo serviço Orders, na mesma transação da encomenda (partição delivery).
import { NotFoundError, ValidationError } from '../../../../libs/platform/errors.js';

const NEXT = { SCHEDULED: 'OUT_FOR_DELIVERY', OUT_FOR_DELIVERY: 'DELIVERED' };

export function createDeliveryService({ deliveryRepository }) {
  return {
    async list() {
      return deliveryRepository.findAll();
    },
    async advance(id) {
      const job = deliveryRepository.findById(id);
      if (!job) throw new NotFoundError(`Entrega ${id} não existe`);
      const next = NEXT[job.status];
      if (!next) throw new ValidationError(`A entrega ${id} já foi concluída`);
      deliveryRepository.setStatus(id, next);
      return deliveryRepository.findById(id);
    },
  };
}
