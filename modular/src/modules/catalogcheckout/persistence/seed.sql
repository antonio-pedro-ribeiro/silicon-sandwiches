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
