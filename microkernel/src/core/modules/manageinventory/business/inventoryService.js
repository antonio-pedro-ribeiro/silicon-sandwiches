// ManageInventory: converte sandes em ingredientes (via Recipes) e reserva-os no stock da loja.
import { ValidationError } from '../../../shared/errors.js';

export function createInventoryService({ stockRepository, recipes }) {
  async function reserve(storeId, lines) {
    const needs = new Map();
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
    async release(reservationId) {
      return stockRepository.release(reservationId);
    },
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
