-- Tabelas do módulo ManageInventory. store_id identifica uma loja do módulo Location (sem chave estrangeira).
CREATE TABLE IF NOT EXISTS inventory_stock_level (
  store_id   TEXT    NOT NULL,
  ingredient TEXT    NOT NULL,
  quantity   INTEGER NOT NULL CHECK (quantity >= 0),
  PRIMARY KEY (store_id, ingredient)
);

CREATE TABLE IF NOT EXISTS inventory_stock_reservation (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id   TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('ACTIVE', 'RELEASED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_stock_reservation_line (
  reservation_id INTEGER NOT NULL REFERENCES inventory_stock_reservation (id),
  ingredient     TEXT    NOT NULL,
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (reservation_id, ingredient)
);
