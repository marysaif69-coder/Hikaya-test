-- What has actually been paid on an order. total_cents is what the order is worth now; after the
-- team changes the items the two can differ, and only the difference is charged or refunded.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_cents INT NOT NULL DEFAULT 0;
UPDATE orders SET paid_cents = total_cents WHERE payment_status IN ('paid', 'partly-refunded', 'refunded');

-- Every card payment on an order (the first one, then any balance after a change), so refunds
-- can reach each of them and a second payment doesn't erase the first.
CREATE TABLE IF NOT EXISTS order_payments (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  square_payment_id TEXT UNIQUE,
  amount_cents INT NOT NULL,
  refunded_cents INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS order_payments_order_idx ON order_payments (order_id);
INSERT INTO order_payments (order_id, square_payment_id, amount_cents, refunded_cents)
  SELECT id, square_payment_id, total_cents, LEAST(refunded_cents, total_cents) FROM orders WHERE square_payment_id IS NOT NULL
  ON CONFLICT (square_payment_id) DO NOTHING;
