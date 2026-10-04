-- Which cup a waitlist sign-up drinks (optional), and when a refill reminder went out for an order.
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS cup TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refill_sent_at TIMESTAMPTZ;
