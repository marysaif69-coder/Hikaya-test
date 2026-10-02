-- Shop management: live prices, stock and visibility, seasons, promo codes, refunds,
-- sample orders, and the team's answers for Ask Hikaya.

-- Overrides for the product file. A row only exists for a product the team has changed.
CREATE TABLE product_settings (
  product_id TEXT PRIMARY KEY,
  price_cents INT,                         -- NULL = the price in the product file
  visible BOOLEAN NOT NULL DEFAULT TRUE,   -- FALSE = not shown on the site at all (off season, not launched)
  available BOOLEAN NOT NULL DEFAULT TRUE, -- FALSE = shown as sold out, cannot be ordered
  stock INT,                               -- NULL = no limit; otherwise how many can still be ordered
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE promo_codes (
  code TEXT PRIMARY KEY,                   -- always upper-case
  kind TEXT NOT NULL,                      -- percent | amount | free-delivery
  value INT NOT NULL DEFAULT 0,            -- percent (1–100) or cents
  min_subtotal_cents INT NOT NULL DEFAULT 0,
  starts_on DATE,
  ends_on DATE,
  max_uses INT,                            -- NULL = unlimited
  uses INT NOT NULL DEFAULT 0,
  once_per_email BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  note TEXT,                               -- e.g. "Store credit for HK-7K3MD"
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN discount_cents INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN promo_code TEXT;
ALTER TABLE orders ADD COLUMN refunded_cents INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN square_payment_id TEXT;
ALTER TABLE orders ADD COLUMN is_sample BOOLEAN NOT NULL DEFAULT FALSE;  -- made-up orders for trying the desk
CREATE INDEX orders_sample_idx ON orders (is_sample);

CREATE TABLE refunds (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL,
  method TEXT NOT NULL,                    -- card | e-transfer | cash | store-credit
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'done',     -- done | pending | failed
  square_refund_id TEXT,
  credit_code TEXT,                        -- the promo code issued for store credit
  actor TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX refunds_order_idx ON refunds (order_id);

-- Ramadan and Eid switch on and off from the admin desk.
INSERT INTO settings (key, value) VALUES ('seasons', '{"ramadan": true, "eid": true}') ON CONFLICT (key) DO NOTHING;

-- Answers the team writes in the admin desk. Ask Hikaya reads them on every message, so a
-- correction works straight away, without a deploy.
CREATE TABLE ask_notes (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  from_chat INT REFERENCES chats(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
