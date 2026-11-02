-- Esquema único da aplicação (corte técnico: uma base de dados para tudo).
-- Repare-se nas chaves estrangeiras entre tabelas de componentes diferentes
-- (encomendas → lojas, bilhetes da cozinha → encomendas, …): é o acoplamento
-- ao nível dos dados que o livro aponta ao corte técnico.

-- Location ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store (
  id      TEXT PRIMARY KEY,
  name    TEXT    NOT NULL,
  city    TEXT    NOT NULL,
  address TEXT    NOT NULL,
  open    INTEGER NOT NULL DEFAULT 1
);

-- Catalog -------------------------------------------------------------------
-- Catálogo comum: igual em todas as lojas.
CREATE TABLE IF NOT EXISTS sandwich (
  id               TEXT PRIMARY KEY,
  name             TEXT    NOT NULL,
  base_price_cents INTEGER NOT NULL CHECK (base_price_cents >= 0),
  local_only       INTEGER NOT NULL DEFAULT 0  -- 1 = só se vende nas lojas que o ativem
);

-- Personalização local: cada loja pode mudar o preço ou a disponibilidade.
CREATE TABLE IF NOT EXISTS store_menu (
  store_id    TEXT    NOT NULL REFERENCES store (id),
  sandwich_id TEXT    NOT NULL REFERENCES sandwich (id),
  price_cents INTEGER,                    -- NULL = usa o preço comum
  available   INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (store_id, sandwich_id)
);

-- Checkout ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_order (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id           TEXT    NOT NULL REFERENCES store (id),
  customer_id        TEXT    NOT NULL,
  fulfilment         TEXT    NOT NULL CHECK (fulfilment IN ('pickup', 'delivery')),
  subtotal_cents     INTEGER NOT NULL,
  discount_cents     INTEGER NOT NULL,
  delivery_fee_cents INTEGER NOT NULL,
  total_cents        INTEGER NOT NULL,
  promo_code         TEXT,
  payment_ref        TEXT    NOT NULL,
  status             TEXT    NOT NULL,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_line (
  order_id         INTEGER NOT NULL REFERENCES customer_order (id),
  sandwich_id      TEXT    NOT NULL REFERENCES sandwich (id),
  name             TEXT    NOT NULL,  -- cópia do nome no momento da compra
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL,
  PRIMARY KEY (order_id, sandwich_id)
);

-- Recipes -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recipe_ingredient (
  sandwich_id TEXT    NOT NULL REFERENCES sandwich (id),
  ingredient  TEXT    NOT NULL,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit        TEXT    NOT NULL,
  PRIMARY KEY (sandwich_id, ingredient)
);

-- ManageInventory -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_level (
  store_id   TEXT    NOT NULL REFERENCES store (id),
  ingredient TEXT    NOT NULL,
  quantity   INTEGER NOT NULL CHECK (quantity >= 0),
  PRIMARY KEY (store_id, ingredient)
);

CREATE TABLE IF NOT EXISTS stock_reservation (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id   TEXT NOT NULL REFERENCES store (id),
  status     TEXT NOT NULL CHECK (status IN ('ACTIVE', 'RELEASED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_reservation_line (
  reservation_id INTEGER NOT NULL REFERENCES stock_reservation (id),
  ingredient     TEXT    NOT NULL,
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (reservation_id, ingredient)
);

-- Promotion -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promotion_code (
  code                  TEXT PRIMARY KEY,
  description           TEXT    NOT NULL,
  percent               INTEGER,                    -- ou percentagem…
  amount_cents          INTEGER,                    -- …ou valor fixo
  min_subtotal_cents    INTEGER NOT NULL DEFAULT 0,
  store_id              TEXT REFERENCES store (id), -- NULL = todas as lojas
  max_uses_per_customer INTEGER,                    -- NULL = sem limite
  active                INTEGER NOT NULL DEFAULT 1,
  CHECK ((percent IS NULL) <> (amount_cents IS NULL))
);

CREATE TABLE IF NOT EXISTS promotion_redemption (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  code           TEXT    NOT NULL REFERENCES promotion_code (code),
  customer_id    TEXT    NOT NULL,
  order_id       INTEGER NOT NULL REFERENCES customer_order (id),
  discount_cents INTEGER NOT NULL,
  redeemed_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- MakeOrder -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kitchen_ticket (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL UNIQUE REFERENCES customer_order (id),
  store_id    TEXT    NOT NULL REFERENCES store (id),
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

-- Delivery ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_zone (
  store_id    TEXT PRIMARY KEY REFERENCES store (id),
  fee_cents   INTEGER NOT NULL CHECK (fee_cents >= 0),
  eta_minutes INTEGER NOT NULL CHECK (eta_minutes > 0)
);

CREATE TABLE IF NOT EXISTS delivery_job (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL UNIQUE REFERENCES customer_order (id),
  store_id    TEXT    NOT NULL REFERENCES store (id),
  address     TEXT    NOT NULL,
  status      TEXT    NOT NULL CHECK (status IN ('SCHEDULED', 'OUT_FOR_DELIVERY', 'DELIVERED')),
  eta_minutes INTEGER NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
