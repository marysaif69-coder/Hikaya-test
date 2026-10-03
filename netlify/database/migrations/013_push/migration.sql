-- Phone notifications for the team app (Web Push): each device that turned them on, and the
-- site's own key pair (made once, on first use; never exported in the backup).

CREATE TABLE push_subs (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,                    -- the person (or picked person under a shared login)
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ
);
CREATE INDEX push_subs_email_idx ON push_subs (email);

CREATE TABLE push_keys (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
