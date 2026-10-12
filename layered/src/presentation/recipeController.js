// Rotas de Recipes.
export function registerRecipeRoutes(router, recipeService) {
  router.get('/recipes/:sandwichId', async ({ params }) => {
    const recipe = await recipeService.get(params.sandwichId);
    return recipe ? { body: recipe } : { status: 404, body: { error: 'Receita não encontrada' } };
  });
}
