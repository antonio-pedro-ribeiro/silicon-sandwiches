-- Tabelas do módulo CatalogCheckout. Nenhum outro módulo as pode ler ou escrever
-- (ver scripts/check-modules.js). store_id identifica uma loja do módulo Location,
-- mas sem chave estrangeira: um módulo não referencia tabelas de outro.

-- Catálogo comum: igual em todas as lojas.
CREATE TABLE IF NOT EXISTS checkout_sandwich (
  id               TEXT PRIMARY KEY,
  name             TEXT    NOT NULL,
  base_price_cents INTEGER NOT NULL CHECK (base_price_cents >= 0),
  local_only       INTEGER NOT NULL DEFAULT 0  -- 1 = só se vende nas lojas que o ativem
);

-- Personalização local: cada loja pode mudar o preço ou a disponibilidade.
CREATE TABLE IF NOT EXISTS checkout_store_menu (
  store_id    TEXT    NOT NULL,
  sandwich_id TEXT    NOT NULL REFERENCES checkout_sandwich (id),
  price_cents INTEGER,                    -- NULL = usa o preço comum
  available   INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (store_id, sandwich_id)
);

CREATE TABLE IF NOT EXISTS checkout_customer_order (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id           TEXT    NOT NULL,
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

CREATE TABLE IF NOT EXISTS checkout_order_line (
  order_id         INTEGER NOT NULL REFERENCES checkout_customer_order (id),
  sandwich_id      TEXT    NOT NULL REFERENCES checkout_sandwich (id),
  name             TEXT    NOT NULL,  -- cópia do nome no momento da compra
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL,
  PRIMARY KEY (order_id, sandwich_id)
);
