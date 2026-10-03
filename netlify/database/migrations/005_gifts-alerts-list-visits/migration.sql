-- Gift orders, "email me when it's back", the mailing list with CASL consent, review
-- requests, and cookie-free visit counts.

ALTER TABLE orders ADD COLUMN gift BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN gift_to TEXT;          -- recipient's name
ALTER TABLE orders ADD COLUMN gift_phone TEXT;       -- recipient's phone, for the driver
ALTER TABLE orders ADD COLUMN gift_message TEXT;     -- the card message
ALTER TABLE orders ADD COLUMN review_asked_at TIMESTAMPTZ;

-- People waiting for a sold-out or out-of-season product.
CREATE TABLE stock_alerts (
  id SERIAL PRIMARY KEY,
  product_id TEXT NOT NULL,
  email TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  UNIQUE (product_id, email)
);

-- The mailing list. CASL: express consent, recorded with its wording and time; confirmed by a
-- link in an email (double opt-in); one click to leave.
CREATE TABLE subscribers (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  lang TEXT NOT NULL DEFAULT 'en',
  source TEXT NOT NULL,                 -- footer | checkout
  consent_text TEXT NOT NULL,
  consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirm_token_hash TEXT,
  confirmed_at TIMESTAMPTZ,
  unsub_token TEXT NOT NULL,            -- random, goes in every email's unsubscribe link
  unsubscribed_at TIMESTAMPTZ
);

-- Page views per day and page, no cookies and nothing about the visitor.
CREATE TABLE page_views (
  day DATE NOT NULL,
  path TEXT NOT NULL,
  ref TEXT NOT NULL DEFAULT '',         -- the other site that linked here, if any (domain only)
  n INT NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path, ref)
);
