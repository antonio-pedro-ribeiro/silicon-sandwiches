-- Base de dados do serviço Recipes. sandwich_id é uma sandes do serviço Checkout (está noutra base de dados).
CREATE TABLE IF NOT EXISTS recipe_ingredient (
  sandwich_id TEXT    NOT NULL,
  ingredient  TEXT    NOT NULL,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit        TEXT    NOT NULL,
  PRIMARY KEY (sandwich_id, ingredient)
);
