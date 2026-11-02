// Biblioteca de entidades da partição inventory: stock por loja, reservas e receitas.
export { createStockRepository } from './stockRepository.ts';
export { createRecipeRepository } from './recipeRepository.ts';
export type { StockLevel, StockRepository } from './stockRepository.ts';
export type { RecipeIngredient, RecipeRepository } from './recipeRepository.ts';
