// API do serviço Recipes. A mesma rota serve a interface (pelo gateway) e o serviço Inventory.
import type { Router } from '../../../../platform/http.ts';
import type { RecipeService } from '../business/recipeService.ts';

export function registerRecipeApi(router: Router, recipeService: RecipeService): void {
  router.get('/recipes/:sandwichId', async ({ params }) => {
    const recipe = await recipeService.get(params.sandwichId);
    return recipe ? { body: recipe } : { status: 404, body: { error: 'Receita não encontrada' } };
  });
}
