-- Hikaya orders, accounts and settings. Money is stored in cents (CAD).

CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,            -- always lower-case
  name TEXT,
  phone TEXT,
  lang TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One-time login codes (stored hashed). Customers and team use the same email-code login.
CREATE TABLE auth_codes (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX auth_codes_email_idx ON auth_codes (email, created_at DESC);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',   -- 'customer' | 'admin'
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,                -- e.g. HK-7Q2M4
  customer_id INT REFERENCES customers(id),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'en',
  method TEXT NOT NULL,                    -- 'pickup' | 'delivery'
  street TEXT,
  postal TEXT,
  slot_date DATE NOT NULL,
  slot_window TEXT NOT NULL,
  payment TEXT NOT NULL,                   -- 'at-pickup' | 'e-transfer' | 'card'
  payment_status TEXT NOT NULL DEFAULT 'unpaid',   -- 'unpaid' | 'paid' | 'refunded'
  status TEXT NOT NULL DEFAULT 'received', -- received | confirmed | ready | out-for-delivery | completed | cancelled
  subtotal_cents INT NOT NULL,
  delivery_cents INT NOT NULL DEFAULT 0,
  total_cents INT NOT NULL,
  notes TEXT,
  guest_token_hash TEXT NOT NULL,          -- lets a guest open their order from the email link
  square_order_id TEXT,
  square_link_url TEXT,
  reminded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX orders_email_idx ON orders (email);
CREATE INDEX orders_slot_idx ON orders (slot_date, slot_window);
CREATE INDEX orders_status_idx ON orders (status);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  option TEXT,
  option_en TEXT,
  option_ar TEXT,
  qty INT NOT NULL,
  unit_cents INT NOT NULL
);
CREATE INDEX order_items_order_idx ON order_items (order_id);

-- Everything that happens to an order: status changes, payments, emails, notes.
CREATE TABLE order_events (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  detail TEXT,
  actor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX order_events_order_idx ON order_events (order_id, created_at);

CREATE TABLE email_log (
  id SERIAL PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  kind TEXT NOT NULL,
  order_id INT REFERENCES orders(id) ON DELETE SET NULL,
  status TEXT NOT NULL,                    -- 'sent' | 'skipped' | 'failed'
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
INSERT INTO settings (key, value) VALUES
  ('capacity', '{"pickup": 12, "delivery": 8}'),
  ('ordering', '{"open": true, "firstDay": "2027-01-22", "cutoffHour": 20}');
