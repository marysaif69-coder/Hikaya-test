-- Every Square checkout made for an order (the first one, and a new one after each change), so a
-- payment on an older link (an open tab, browser history) still finds its order.
CREATE TABLE IF NOT EXISTS order_square_orders (
  square_order_id TEXT PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE
);
INSERT INTO order_square_orders (square_order_id, order_id)
  SELECT square_order_id, id FROM orders WHERE square_order_id IS NOT NULL
  ON CONFLICT (square_order_id) DO NOTHING;
