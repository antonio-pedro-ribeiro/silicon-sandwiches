// Stock das lojas: consultar e repor. A reserva de ingredientes no checkout é feita pelo serviço Orders,
// diretamente na partição inventory da base de dados partilhada (sem chamar este serviço).
import { ValidationError } from '../../../../libs/platform/errors.js';

export function createInventoryService({ stockRepository }) {
  return {
    async stockFor(storeId) {
      return { storeId, items: stockRepository.findByStore(storeId) };
    },
    async restock(storeId, { ingredient, quantity } = {}) {
      if (typeof ingredient !== 'string' || !ingredient) throw new ValidationError('ingredient é obrigatório');
      if (!Number.isInteger(quantity) || quantity < 1) throw new ValidationError('quantity tem de ser inteira positiva');
      stockRepository.restock(storeId, ingredient, quantity);
      return { storeId, items: stockRepository.findByStore(storeId) };
    },
  };
}
