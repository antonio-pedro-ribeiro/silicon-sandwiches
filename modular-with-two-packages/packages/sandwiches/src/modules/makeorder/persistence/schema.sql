-- Tabelas do módulo MakeOrder. order_id e store_id referem-se a outros módulos (sem chave estrangeira);
-- os artigos são copiados para o bilhete, em vez de lidos das tabelas do checkout.
CREATE TABLE IF NOT EXISTS kitchen_ticket (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL UNIQUE,
  store_id    TEXT    NOT NULL,
  status      TEXT    NOT NULL CHECK (status IN ('QUEUED', 'PREPARING', 'READY', 'COLLECTED')),
  received_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kitchen_ticket_item (
  ticket_id INTEGER NOT NULL REFERENCES kitchen_ticket (id),
  name      TEXT    NOT NULL,
  quantity  INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (ticket_id, name)
);
