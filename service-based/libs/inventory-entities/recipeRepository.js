// Receitas: ingredientes e quantidades de cada sandes.
export function createRecipeRepository(db) {
  const bySandwich = db.prepare(
    'SELECT ingredient, quantity, unit FROM recipe_ingredient WHERE sandwich_id = ? ORDER BY ingredient',
  );

  return {
    findBySandwich: (sandwichId) => bySandwich.all(sandwichId).map((r) => ({ ...r })),
  };
}
