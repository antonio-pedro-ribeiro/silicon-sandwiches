// Receitas: ingredientes e quantidades de cada sandes.
import { rowsOf, type Database } from '../../../shared/db.ts';

export interface RecipeIngredient {
  ingredient: string;
  quantity: number;
  unit: string;
}

export type RecipeRepository = ReturnType<typeof createRecipeRepository>;

export function createRecipeRepository(db: Database) {
  const bySandwich = db.prepare(
    'SELECT ingredient, quantity, unit FROM recipe_ingredient WHERE sandwich_id = ? ORDER BY ingredient',
  );

  return {
    findBySandwich: (sandwichId: string): RecipeIngredient[] =>
      rowsOf<RecipeIngredient>(bySandwich.all(sandwichId)).map((r) => ({ ...r })),
  };
}
