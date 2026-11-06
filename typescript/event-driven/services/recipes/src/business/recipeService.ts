// Recipes: o que leva cada sandes. O ManageInventory usa-as para saber que ingredientes reservar.
import type { RecipeIngredient, RecipeRepository } from '../persistence/recipeRepository.ts';

export interface Recipe {
  sandwichId: string;
  ingredients: RecipeIngredient[];
}

export type RecipeService = ReturnType<typeof createRecipeService>;

export function createRecipeService({ recipeRepository }: { recipeRepository: RecipeRepository }) {
  return {
    async get(sandwichId: string): Promise<Recipe | undefined> {
      const ingredients = recipeRepository.findBySandwich(sandwichId);
      return ingredients.length ? { sandwichId, ingredients } : undefined;
    },
  };
}
