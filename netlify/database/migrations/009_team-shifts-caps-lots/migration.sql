-- The internal team: roles (helper / packer / driver), volunteers, papers with expiry dates,
-- shifts with sign-up and hours, capacity caps, production lots for traceability, and supplies.

ALTER TABLE team_members ADD COLUMN volunteer BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE team_members ADD COLUMN food_cert_expires DATE;     -- food handler training certificate
ALTER TABLE team_members ADD COLUMN licence_expires DATE;       -- driver's licence
ALTER TABLE team_members ADD COLUMN insurance_expires DATE;     -- car insurance
ALTER TABLE team_members ADD COLUMN docs_reminded JSONB NOT NULL DEFAULT '{}';

ALTER TABLE orders ADD COLUMN packed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN packed_by TEXT;

CREATE TABLE shifts (
  id SERIAL PRIMARY KEY,
  day DATE NOT NULL,
  starts TEXT NOT NULL,                     -- '09:00'
  ends TEXT NOT NULL,                       -- '12:00'
  kind TEXT NOT NULL,                       -- packing | driving | counter | other
  spots INT NOT NULL DEFAULT 1,
  note TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX shifts_day_idx ON shifts (day);

CREATE TABLE shift_people (
  shift_id INT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  how TEXT NOT NULL DEFAULT 'signed-up',    -- signed-up | assigned
  checked_in_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,
  reminded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (shift_id, email)
);

-- Per-product limit per day (e.g. 20 Iftar boxes a day). NULL = no limit.
ALTER TABLE product_settings ADD COLUMN daily_cap INT;

CREATE TABLE lots (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,                -- e.g. NAJDI-261003-1
  item_kind TEXT NOT NULL,                  -- coffee | dates
  item_id TEXT NOT NULL,                    -- product id (coffee) or date variety
  made_on DATE NOT NULL,
  best_before DATE,
  quantity TEXT,                            -- free text, e.g. "12 kg" or "40 pouches"
  supplier TEXT,
  note TEXT,
  made_by TEXT,
  used_up_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX lots_item_idx ON lots (item_kind, item_id, made_on);

CREATE TABLE supplies (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs',
  on_hand NUMERIC,
  low_at NUMERIC,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO supplies (key, name, unit) VALUES
  ('pouch250', '250 g pouches', 'pcs'), ('pouch100', '100 g pouches (qishr)', 'pcs'),
  ('boxD24', 'Gift boxes with D24 insert', 'pcs'), ('boxC12', 'Gift boxes with C12 insert', 'pcs'), ('boxC2', 'Gift boxes with C2 insert', 'pcs'),
  ('trayEveryday', 'Everyday 500 g trays', 'pcs'), ('sleeveRegular', 'Gold sleeves', 'pcs'), ('sleeveRamadan', 'Ramadan sleeves', 'pcs'), ('sleeveEid', 'Eid sleeves', 'pcs'),
  ('paperCups', 'Paper cups for dates', 'pcs'), ('bags', 'Carry bags', 'pcs'), ('labels', 'Product labels', 'pcs')
ON CONFLICT DO NOTHING;
