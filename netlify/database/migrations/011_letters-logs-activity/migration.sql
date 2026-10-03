-- Letters to the mailing list, food-safety checklists, team announcements, the desk's activity
-- log, and the "you're next" notice for deliveries.

CREATE TABLE letters (
  id SERIAL PRIMARY KEY,
  subject_en TEXT NOT NULL,
  subject_ar TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_ar TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',      -- draft | sent
  sent_at TIMESTAMPTZ,
  sent_count INT NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE checklist_logs (
  id SERIAL PRIMARY KEY,
  day DATE NOT NULL,
  checklist TEXT NOT NULL,                   -- key of the checklist template
  answers JSONB NOT NULL,                    -- [{ item, done, value }]
  note TEXT,
  done_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX checklist_logs_day_idx ON checklist_logs (day);

CREATE TABLE announcements (
  id SERIAL PRIMARY KEY,
  body TEXT NOT NULL,
  emailed BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE activity (
  id SERIAL PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,                      -- e.g. "products/najdi"
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX activity_created_idx ON activity (created_at DESC);

ALTER TABLE orders ADD COLUMN next_notified_at TIMESTAMPTZ;

-- People who work under a shared login (e.g. everyone at hello@hikayacoffee.ca picks their name
-- after logging in). Their `email` is an internal handle; reminders go to the shared login's inbox.
ALTER TABLE team_members ADD COLUMN shared BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE team_members ADD COLUMN login_email TEXT;

-- Picking your name under a shared login is confirmed with a code sent to your own email; the
-- device then keeps a token for that person.
CREATE TABLE as_tokens (
  token_hash TEXT PRIMARY KEY,
  member_id INT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  login TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
