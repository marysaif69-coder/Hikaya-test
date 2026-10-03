-- A private note the team keeps about a customer (e.g. "allergic to sesame", "leave at side door").
ALTER TABLE customers ADD COLUMN team_note TEXT;
ALTER TABLE customers ADD COLUMN team_note_by TEXT;
ALTER TABLE customers ADD COLUMN team_note_at TIMESTAMPTZ;

-- Which team member drives a delivery (assigned in the Day sheet; the Driver page shows each
-- driver their own stops).
ALTER TABLE orders ADD COLUMN driver_email TEXT;
CREATE INDEX orders_driver_idx ON orders (slot_date, driver_email);

-- Drivers and helpers the owners add in the desk (Admin → Drivers). Owners stay in ADMIN_EMAILS.
CREATE TABLE team_members (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,               -- lower-case; they log in with the usual email code
  role TEXT NOT NULL DEFAULT 'driver',      -- 'driver' | 'helper'
  name TEXT,
  phone TEXT,
  vehicle TEXT,
  status TEXT NOT NULL DEFAULT 'invited',   -- invited | active | off
  agreed_text TEXT,                         -- the driver guide they agreed to at onboarding
  agreed_at TIMESTAMPTZ,
  invited_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Delivery: who collected money at the door, the photo, and when the route started / ended.
ALTER TABLE orders ADD COLUMN collected_method TEXT;        -- 'cash' | 'card'
ALTER TABLE orders ADD COLUMN collected_cents INT;
ALTER TABLE orders ADD COLUMN collected_by TEXT;
ALTER TABLE orders ADD COLUMN cash_handed_in_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN out_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN delivered_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN delivered_by TEXT;

CREATE TABLE delivery_photos (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  mime TEXT NOT NULL,
  data BYTEA NOT NULL,
  taken_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX delivery_photos_order_idx ON delivery_photos (order_id);
