// Delivery (núcleo): a taxa e o tempo vêm do plug-in da loja; sem plug-in (ou sem delivery), não há entregas.
// Cada entrega avança SCHEDULED → OUT_FOR_DELIVERY → DELIVERED.
import { NotFoundError, ValidationError } from '../../../shared/errors.js';

const NEXT = { SCHEDULED: 'OUT_FOR_DELIVERY', OUT_FOR_DELIVERY: 'DELIVERED' };

export function createDeliveryService({ deliveryRepository, plugins }) {
  const zoneOf = (storeId) => plugins.store(storeId)?.delivery;

  return {
    async quote({ store }) {
      const zone = zoneOf(store.id);
      if (!zone) return { available: false, reason: `A loja ${store.name} não faz entregas` };
      return { available: true, feeCents: zone.feeCents, etaMinutes: zone.etaMinutes };
    },
    async schedule({ order, address }) {
      return deliveryRepository.create({
        orderId: order.id,
        storeId: order.storeId,
        address,
        etaMinutes: zoneOf(order.storeId).etaMinutes,
      });
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
