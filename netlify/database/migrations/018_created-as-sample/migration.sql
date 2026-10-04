-- Whether an order was made as a sample (generated in the desk, or placed as a sample), as opposed to
-- a real order ticked "sample" later. "Remove all sample orders" deletes only the first kind, so a
-- real rehearsal order keeps its refunds and history.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_as_sample BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE orders o SET created_as_sample = TRUE WHERE o.is_sample AND (o.email LIKE '%.sample@example.com'
  OR EXISTS (SELECT 1 FROM order_events e WHERE e.order_id = o.id AND e.kind = 'created' AND e.detail = 'Sample order'));
-- Generated sample orders marked paid count as paid in full.
UPDATE orders SET paid_cents = total_cents WHERE created_as_sample AND payment_status = 'paid' AND paid_cents = 0;
