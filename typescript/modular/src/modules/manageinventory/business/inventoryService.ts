// ManageInventory: converte sandes em ingredientes (via Recipes) e reserva-os no stock da loja.
import { ValidationError } from '../../../shared/errors.ts';
import type { StockLevel, StockRepository } from '../persistence/stockRepository.ts';

export type Reservation = { ok: true; reservationId: number } | { ok: false; reason: string };

export interface StockReport {
  storeId: string;
  items: StockLevel[];
}

// Do Recipes, o inventário só precisa de saber os ingredientes de cada sandes.
export interface RecipeSource {
  get(sandwichId: string): Promise<{ ingredients: { ingredient: string; quantity: number }[] } | undefined>;
}

export type InventoryService = ReturnType<typeof createInventoryService>;

export function createInventoryService({ stockRepository, recipes }: { stockRepository: StockRepository; recipes: RecipeSource }) {
  async function reserve(storeId: string, lines: { sandwichId: string; name: string; quantity: number }[]): Promise<Reservation> {
    const needs = new Map<string, number>();
    for (const line of lines) {
      const recipe = await recipes.get(line.sandwichId);
      if (!recipe) return { ok: false, reason: `Não há receita para ${line.name}` };
      for (const { ingredient, quantity } of recipe.ingredients) {
        needs.set(ingredient, (needs.get(ingredient) ?? 0) + quantity * line.quantity);
      }
    }
    const result = stockRepository.reserve(
      storeId,
      [...needs].map(([ingredient, quantity]) => ({ ingredient, quantity })),
    );
    return result.ok
      ? { ok: true, reservationId: result.reservationId }
      : { ok: false, reason: `Não há ${result.ingredient} suficiente em ${storeId}` };
  }

  return {
    reserve,
    async release(reservationId: number): Promise<boolean> {
      return stockRepository.release(reservationId);
    },
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
