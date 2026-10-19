// Recipes: o que leva cada sandes. O ManageInventory usa-as para saber que ingredientes reservar.
export function createRecipeService({ recipeRepository }) {
  return {
    async get(sandwichId) {
      const ingredients = recipeRepository.findBySandwich(sandwichId);
      return ingredients.length ? { sandwichId, ingredients } : undefined;
    },
  };
}
