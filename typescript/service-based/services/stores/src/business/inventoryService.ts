// Stock das lojas: consultar e repor. A reserva de ingredientes no checkout é feita pelo serviço Orders,
// diretamente na partição inventory da base de dados partilhada (sem chamar este serviço).
import { ValidationError } from '../../../../libs/platform/errors.ts';
import type { StockLevel, StockRepository } from '../../../../libs/inventory-entities/index.ts';

export interface StockReport {
  storeId: string;
  items: StockLevel[];
}

export type InventoryService = ReturnType<typeof createInventoryService>;

export function createInventoryService({ stockRepository }: { stockRepository: StockRepository }) {
  return {
    async stockFor(storeId: string): Promise<StockReport> {
      return { storeId, items: stockRepository.findByStore(storeId) };
    },
    async restock(storeId: string, input: unknown): Promise<StockReport> {
      const { ingredient, quantity } = (input ?? {}) as { ingredient?: unknown; quantity?: unknown };
      if (typeof ingredient !== 'string' || !ingredient) throw new ValidationError('ingredient é obrigatório');
      if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
        throw new ValidationError('quantity tem de ser inteira positiva');
      }
      stockRepository.restock(storeId, ingredient, quantity);
      return { storeId, items: stockRepository.findByStore(storeId) };
    },
  };
}
