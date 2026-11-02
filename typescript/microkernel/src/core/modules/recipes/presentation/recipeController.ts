// Rotas de Recipes.
import type { Router } from '../../../shared/http.ts';
import type { RecipeService } from '../business/recipeService.ts';

export function registerRecipeRoutes(router: Router, recipeService: RecipeService): void {
  router.get('/recipes/:sandwichId', async ({ params }) => {
    const recipe = await recipeService.get(params.sandwichId);
    return recipe ? { body: recipe } : { status: 404, body: { error: 'Receita não encontrada' } };
  });
}
