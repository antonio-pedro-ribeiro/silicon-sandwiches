-- Tabelas do módulo CatalogCheckout (núcleo). store_id identifica uma loja do módulo Location,
-- mas sem chave estrangeira: um módulo não referencia tabelas de outro.
-- Não há tabela de menus locais: a personalização de cada loja está no plug-in dessa loja.

-- Catálogo comum: igual em todas as lojas.
CREATE TABLE IF NOT EXISTS checkout_sandwich (
  id               TEXT PRIMARY KEY,
  name             TEXT    NOT NULL,
  base_price_cents INTEGER NOT NULL CHECK (base_price_cents >= 0)
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

-- sandwich_id sem chave estrangeira: uma sandes exclusiva (a francesinha) vem de um plug-in
-- e não está no catálogo comum.
CREATE TABLE IF NOT EXISTS checkout_order_line (
  order_id         INTEGER NOT NULL REFERENCES checkout_customer_order (id),
  sandwich_id      TEXT    NOT NULL,
  name             TEXT    NOT NULL,  -- cópia do nome no momento da compra
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL,
  PRIMARY KEY (order_id, sandwich_id)
);
