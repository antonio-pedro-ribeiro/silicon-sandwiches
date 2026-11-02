-- Dados de exemplo (preços, stocks, taxas e códigos são inventados).

-- Location
INSERT INTO store (id, name, city, address, open) VALUES
  ('lisboa-campo-grande', 'Lisboa · Campo Grande', 'Lisboa',  'Campo Grande 16',      1),
  ('porto-aliados',       'Porto · Aliados',       'Porto',   'Avenida dos Aliados 10', 1),
  ('coimbra-baixa',       'Coimbra · Baixa',       'Coimbra', 'Rua Ferreira Borges 5', 0);

-- Catalog
INSERT INTO sandwich (id, name, base_price_cents, local_only) VALUES
  ('tosta-mista', 'Tosta mista',           350, 0),
  ('bifana',      'Bifana',                450, 0),
  ('prego',       'Prego no pão',          550, 0),
  ('wrap-vegan',  'Wrap vegan',            500, 0),
  ('francesinha', 'Francesinha em sandes', 700, 1);

INSERT INTO store_menu (store_id, sandwich_id, price_cents, available) VALUES
  ('porto-aliados',       'francesinha', 650,  1),  -- exclusivo do Porto, com preço local
  ('lisboa-campo-grande', 'bifana',      480,  1),  -- preço local mais alto
  ('lisboa-campo-grande', 'prego',       NULL, 0);  -- não se vende em Lisboa

-- Recipes
INSERT INTO recipe_ingredient (sandwich_id, ingredient, quantity, unit) VALUES
  ('tosta-mista', 'pão de forma',         2, 'fatia'),
  ('tosta-mista', 'fiambre',              1, 'fatia'),
  ('tosta-mista', 'queijo',               2, 'fatia'),
  ('tosta-mista', 'manteiga',             1, 'dose'),
  ('bifana',      'papo-seco',            1, 'un'),
  ('bifana',      'febra de porco',       1, 'un'),
  ('prego',       'papo-seco',            1, 'un'),
  ('prego',       'bife',                 1, 'un'),
  ('prego',       'manteiga',             1, 'dose'),
  ('wrap-vegan',  'tortilha',             1, 'un'),
  ('wrap-vegan',  'húmus',                1, 'dose'),
  ('wrap-vegan',  'legumes',              1, 'dose'),
  ('francesinha', 'pão de forma',         2, 'fatia'),
  ('francesinha', 'linguiça',             1, 'un'),
  ('francesinha', 'fiambre',              1, 'fatia'),
  ('francesinha', 'bife',                 1, 'un'),
  ('francesinha', 'queijo',               3, 'fatia'),
  ('francesinha', 'molho de francesinha', 1, 'dose');

-- ManageInventory: 40 unidades de cada ingrediente comum em cada loja
WITH stores (store_id) AS (VALUES ('lisboa-campo-grande'), ('porto-aliados'), ('coimbra-baixa')),
     ingredients (ingredient) AS (VALUES ('pão de forma'), ('fiambre'), ('queijo'), ('manteiga'),
       ('papo-seco'), ('febra de porco'), ('bife'), ('tortilha'), ('húmus'), ('legumes'))
INSERT INTO stock_level (store_id, ingredient, quantity)
SELECT store_id, ingredient, 40 FROM stores, ingredients;

INSERT INTO stock_level (store_id, ingredient, quantity) VALUES
  ('porto-aliados', 'linguiça',             15),
  ('porto-aliados', 'molho de francesinha', 10);

-- Promotion
INSERT INTO promotion_code
  (code, description, percent, amount_cents, min_subtotal_cents, store_id, max_uses_per_customer) VALUES
  ('FCUL10',   '10% para a comunidade FCUL',           10,   NULL, 0,    NULL,            NULL),
  ('MENOS1',   '1 € de desconto acima de 10 €',        NULL, 100,  1000, NULL,            NULL),
  ('PORTO15',  '15% só na loja dos Aliados',           15,   NULL, 0,    'porto-aliados', NULL),
  ('BEMVINDO', '2 € na primeira encomenda',            NULL, 200,  500,  NULL,            1);

-- Delivery (Coimbra não faz entregas)
INSERT INTO delivery_zone (store_id, fee_cents, eta_minutes) VALUES
  ('lisboa-campo-grande', 300, 35),
  ('porto-aliados',       250, 30);
