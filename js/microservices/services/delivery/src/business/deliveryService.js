// Delivery: taxa e tempo por loja; cada entrega avança SCHEDULED → OUT_FOR_DELIVERY → DELIVERED.
import { NotFoundError, ValidationError } from '../../../../platform/errors.js';

const NEXT = { SCHEDULED: 'OUT_FOR_DELIVERY', OUT_FOR_DELIVERY: 'DELIVERED' };

export function createDeliveryService({ deliveryRepository }) {
  return {
    async quote({ store }) {
      const zone = deliveryRepository.findZone(store.id);
      if (!zone) return { available: false, reason: `A loja ${store.name} não faz entregas` };
      return { available: true, feeCents: zone.feeCents, etaMinutes: zone.etaMinutes };
    },
    // Reação ao evento OrderPlaced. O mesmo evento pode chegar mais de uma vez: uma só entrega por encomenda.
    async schedule({ orderId, storeId, address }) {
      const existing = deliveryRepository.findByOrder(orderId);
      if (existing) return existing;
      const zone = deliveryRepository.findZone(storeId);
      return deliveryRepository.create({ orderId, storeId, address, etaMinutes: zone.etaMinutes });
    },
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
