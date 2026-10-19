INSERT INTO promotion_code
  (code, description, percent, amount_cents, min_subtotal_cents, store_id, max_uses_per_customer) VALUES
  ('FCUL10',   '10% para a comunidade FCUL',    10,   NULL, 0,    NULL,            NULL),
  ('MENOS1',   '1 € de desconto acima de 10 €', NULL, 100,  1000, NULL,            NULL),
  ('PORTO15',  '15% só na loja dos Aliados',    15,   NULL, 0,    'porto-aliados', NULL),
  ('BEMVINDO', '2 € na primeira encomenda',     NULL, 200,  500,  NULL,            1);
