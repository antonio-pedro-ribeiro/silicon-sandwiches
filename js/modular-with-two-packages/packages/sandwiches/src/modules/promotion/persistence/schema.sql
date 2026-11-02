-- Tabelas do módulo Promotion. store_id e order_id referem-se a outros módulos (sem chave estrangeira).
CREATE TABLE IF NOT EXISTS promotion_code (
  code                  TEXT PRIMARY KEY,
  description           TEXT    NOT NULL,
  percent               INTEGER,              -- ou percentagem…
  amount_cents          INTEGER,              -- …ou valor fixo
  min_subtotal_cents    INTEGER NOT NULL DEFAULT 0,
  store_id              TEXT,                 -- NULL = todas as lojas
  max_uses_per_customer INTEGER,              -- NULL = sem limite
  active                INTEGER NOT NULL DEFAULT 1,
  CHECK ((percent IS NULL) <> (amount_cents IS NULL))
);

CREATE TABLE IF NOT EXISTS promotion_redemption (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  code           TEXT    NOT NULL REFERENCES promotion_code (code),
  customer_id    TEXT    NOT NULL,
  order_id       INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL,
  redeemed_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
