// Módulo Recipes · API pública.
import { migrateModule, type Database } from '../../shared/db.ts';
import type { Router } from '../../shared/http.ts';
import { createRecipeRepository } from './persistence/recipeRepository.ts';
import { createRecipeService } from './business/recipeService.ts';
import { registerRecipeRoutes } from './presentation/recipeController.ts';

export type { Recipe } from './business/recipeService.ts';
export type RecipesApi = ReturnType<typeof createRecipesModule>['api'];

export function createRecipesModule({ db }: { db: Database }) {
  migrateModule(db, new URL('./persistence/', import.meta.url), 'recipe_ingredient');
  const service = createRecipeService({ recipeRepository: createRecipeRepository(db) });
  return {
    name: 'recipes',
    api: { get: service.get },
    registerRoutes: (router: Router) => registerRecipeRoutes(router, service),
  };
}
