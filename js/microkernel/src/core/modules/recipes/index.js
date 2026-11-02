// Módulo Recipes · API pública.
import { migrateModule } from '../../shared/db.js';
import { createRecipeRepository } from './persistence/recipeRepository.js';
import { createRecipeService } from './business/recipeService.js';
import { registerRecipeRoutes } from './presentation/recipeController.js';

export function createRecipesModule({ db }) {
  migrateModule(db, new URL('./persistence/', import.meta.url), 'recipe_ingredient');
  const service = createRecipeService({ recipeRepository: createRecipeRepository(db) });
  return {
    name: 'recipes',
    api: { get: service.get },
    registerRoutes: (router) => registerRecipeRoutes(router, service),
  };
}
