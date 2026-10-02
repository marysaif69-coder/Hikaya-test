-- Help desk: requests from the help form and from Ask Hikaya, with photos, plus chat transcripts
-- so the team can read what customers asked and turn real questions into test cases.

CREATE TABLE chats (
  id SERIAL PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,         -- the browser holds the token; only its hash is kept
  lang TEXT NOT NULL DEFAULT 'en',
  email TEXT,                              -- set when the visitor is signed in or gives it
  ip_hash TEXT,
  messages JSONB NOT NULL DEFAULT '[]',    -- the exact conversation sent to the model, append-only
  turns INT NOT NULL DEFAULT 0,
  handed_off BOOLEAN NOT NULL DEFAULT FALSE,
  rating TEXT,                             -- 'up' | 'down' from the visitor
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX chats_updated_idx ON chats (updated_at DESC);
CREATE INDEX chats_ip_idx ON chats (ip_hash, updated_at DESC);

CREATE TABLE tickets (
  id SERIAL PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,                -- e.g. Q-7K3MD, shown to the customer
  kind TEXT NOT NULL,                      -- damaged | wrong-item | missing | late | change-order | large-order | question | other
  status TEXT NOT NULL DEFAULT 'open',     -- open | waiting | resolved
  source TEXT NOT NULL DEFAULT 'form',     -- form | ask
  lang TEXT NOT NULL DEFAULT 'en',
  name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  order_ref TEXT,
  summary TEXT NOT NULL,
  details TEXT,
  chat_id INT REFERENCES chats(id) ON DELETE SET NULL,
  upload_token_hash TEXT,                  -- lets the customer attach photos to this request only
  resolution TEXT,                         -- refund | replacement | credit | answered | none
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX tickets_status_idx ON tickets (status, created_at DESC);
CREATE INDEX tickets_email_idx ON tickets (email);

CREATE TABLE ticket_photos (
  id SERIAL PRIMARY KEY,
  ticket_id INT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  mime TEXT NOT NULL,
  data BYTEA NOT NULL,                     -- resized in the browser, at most ~1.5 MB
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ticket_notes (
  id SERIAL PRIMARY KEY,
  ticket_id INT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'note',       -- note | reply | status
  body TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
