-- 40 unidades de cada ingrediente comum em cada loja (números inventados)
WITH stores (store_id) AS (VALUES ('lisboa-campo-grande'), ('porto-aliados'), ('coimbra-baixa')),
     ingredients (ingredient) AS (VALUES ('pão de forma'), ('fiambre'), ('queijo'), ('manteiga'),
       ('papo-seco'), ('febra de porco'), ('bife'), ('tortilha'), ('húmus'), ('legumes'))
INSERT INTO inventory_stock_level (store_id, ingredient, quantity)
SELECT store_id, ingredient, 40 FROM stores, ingredients;

INSERT INTO inventory_stock_level (store_id, ingredient, quantity) VALUES
  ('porto-aliados', 'linguiça',             15),
  ('porto-aliados', 'molho de francesinha', 10);
