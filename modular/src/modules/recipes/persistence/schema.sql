-- Tabelas do módulo Recipes. sandwich_id identifica uma sandes do CatalogCheckout,
-- mas sem chave estrangeira: um módulo não referencia tabelas de outro.
CREATE TABLE IF NOT EXISTS recipe_ingredient (
  sandwich_id TEXT    NOT NULL,
  ingredient  TEXT    NOT NULL,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit        TEXT    NOT NULL,
  PRIMARY KEY (sandwich_id, ingredient)
);
