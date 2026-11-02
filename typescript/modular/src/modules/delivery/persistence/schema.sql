-- Tabelas do módulo Delivery. order_id e store_id referem-se a outros módulos (sem chave estrangeira).
CREATE TABLE IF NOT EXISTS delivery_zone (
  store_id    TEXT PRIMARY KEY,
  fee_cents   INTEGER NOT NULL CHECK (fee_cents >= 0),
  eta_minutes INTEGER NOT NULL CHECK (eta_minutes > 0)
);

CREATE TABLE IF NOT EXISTS delivery_job (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL UNIQUE,
  store_id    TEXT    NOT NULL,
  address     TEXT    NOT NULL,
  status      TEXT    NOT NULL CHECK (status IN ('SCHEDULED', 'OUT_FOR_DELIVERY', 'DELIVERED')),
  eta_minutes INTEGER NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
