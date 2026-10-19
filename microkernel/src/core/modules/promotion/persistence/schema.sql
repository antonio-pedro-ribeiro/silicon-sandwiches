-- Tabelas do módulo Promotion (núcleo). Só as utilizações: cada código é um plug-in.
-- code, customer_id e order_id sem chaves estrangeiras.
CREATE TABLE IF NOT EXISTS promotion_redemption (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  code           TEXT    NOT NULL,
  customer_id    TEXT    NOT NULL,
  order_id       INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL,
  redeemed_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
