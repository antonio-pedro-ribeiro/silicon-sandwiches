-- Partição common: dados de que quase todos os serviços precisam (as lojas).
CREATE TABLE IF NOT EXISTS location_store (
  id      TEXT PRIMARY KEY,
  name    TEXT    NOT NULL,
  city    TEXT    NOT NULL,
  address TEXT    NOT NULL,
  open    INTEGER NOT NULL DEFAULT 1
);
