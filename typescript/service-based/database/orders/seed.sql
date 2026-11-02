-- Dados de exemplo (os preços são inventados).

INSERT INTO checkout_sandwich (id, name, base_price_cents, local_only) VALUES
  ('tosta-mista', 'Tosta mista',           350, 0),
  ('bifana',      'Bifana',                450, 0),
  ('prego',       'Prego no pão',          550, 0),
  ('wrap-vegan',  'Wrap vegan',            500, 0),
  ('francesinha', 'Francesinha em sandes', 700, 1);

INSERT INTO checkout_store_menu (store_id, sandwich_id, price_cents, available) VALUES
  ('porto-aliados',       'francesinha', 650,  1),  -- exclusivo do Porto, com preço local
  ('lisboa-campo-grande', 'bifana',      480,  1),  -- preço local mais alto
  ('lisboa-campo-grande', 'prego',       NULL, 0);  -- não se vende em Lisboa

INSERT INTO promotion_code
  (code, description, percent, amount_cents, min_subtotal_cents, store_id, max_uses_per_customer) VALUES
  ('FCUL10',   '10% para a comunidade FCUL',    10,   NULL, 0,    NULL,            NULL),
  ('MENOS1',   '1 € de desconto acima de 10 €', NULL, 100,  1000, NULL,            NULL),
  ('PORTO15',  '15% só na loja dos Aliados',    15,   NULL, 0,    'porto-aliados', NULL),
  ('BEMVINDO', '2 € na primeira encomenda',     NULL, 200,  500,  NULL,            1);
