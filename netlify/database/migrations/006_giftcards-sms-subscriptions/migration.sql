-- Gift cards, text-message reminders, regular (repeat) orders and the monthly report.

CREATE TABLE gift_cards (
  id SERIAL PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,                 -- e.g. GC-7Q2M4 (for the desk and Square; not the code)
  code TEXT NOT NULL UNIQUE,                -- what the recipient types at checkout, sent once paid
  amount_cents INT NOT NULL,
  balance_cents INT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  to_name TEXT NOT NULL,
  to_email TEXT,                            -- empty: the code goes to the buyer to pass on
  message TEXT,
  lang TEXT NOT NULL DEFAULT 'en',
  payment TEXT NOT NULL,                    -- 'card' | 'e-transfer'
  paid_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  square_order_id TEXT,
  square_link_url TEXT,
  square_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX gift_cards_square_idx ON gift_cards (square_order_id);

ALTER TABLE orders ADD COLUMN gift_card_code TEXT;
ALTER TABLE orders ADD COLUMN gift_card_cents INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN sms_ok BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN sms_reminded_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN subscription_id INT;

-- A regular order: the same basket every 2 or 4 weeks. Each one becomes a normal order a week
-- before its day, paid the usual way. Customers skip, pause or stop it from their account.
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'en',
  method TEXT NOT NULL,
  street TEXT,
  postal TEXT,
  slot_window TEXT NOT NULL,
  payment TEXT NOT NULL,
  lines JSONB NOT NULL,                     -- [{ id, opt, qty }], priced again each time
  every_weeks INT NOT NULL,                 -- 2 or 4
  next_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',    -- active | paused | stopped
  sms_ok BOOLEAN NOT NULL DEFAULT FALSE,
  last_note TEXT,                           -- e.g. why the last one could not be placed
  created_from TEXT,                        -- the order ref it started from
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX subscriptions_next_idx ON subscriptions (status, next_date);
CREATE INDEX subscriptions_email_idx ON subscriptions (email);

CREATE TABLE reports_sent (
  month TEXT PRIMARY KEY,                   -- '2026-10'
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
