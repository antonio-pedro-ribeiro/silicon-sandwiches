// API do serviço Recipes. A mesma rota serve a interface (pelo gateway) e o serviço Inventory.
export function registerRecipeApi(router, recipeService) {
  router.get('/recipes/:sandwichId', async ({ params }) => {
    const recipe = await recipeService.get(params.sandwichId);
    return recipe ? { body: recipe } : { status: 404, body: { error: 'Receita não encontrada' } };
  });
}
