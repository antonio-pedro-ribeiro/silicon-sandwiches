// Microsserviço Recipes: o que leva cada sandes. Não depende de nenhum outro serviço.
import { openDatabase } from '../../../platform/db.ts';
import { createRouter } from '../../../platform/http.ts';
import { createRecipeRepository } from './persistence/recipeRepository.ts';
import { createRecipeService } from './business/recipeService.ts';
import { registerRecipeApi } from './api/recipeApi.ts';

export function createApp({ dbPath = ':memory:' }: { dbPath?: string } = {}) {
  const db = openDatabase(dbPath, new URL('./persistence/', import.meta.url));
  const service = createRecipeService({ recipeRepository: createRecipeRepository(db) });

  const router = createRouter();
  router.get('/health', () => ({ body: { status: 'ok', service: 'recipes' } }));
  registerRecipeApi(router, service);

  return { handler: router.handle, close: () => db.close() };
}
