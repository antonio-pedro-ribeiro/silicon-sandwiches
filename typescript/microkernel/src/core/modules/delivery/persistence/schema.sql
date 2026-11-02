-- Tabelas do módulo Delivery (núcleo). order_id e store_id referem-se a outros módulos (sem chave estrangeira).
-- Não há zonas de entrega: a taxa e o tempo de cada loja estão no plug-in dessa loja.
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
