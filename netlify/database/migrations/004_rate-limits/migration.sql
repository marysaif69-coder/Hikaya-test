-- Simple rate limits: one row per attempt, keyed by what is limited and who (a hashed IP or an
-- email). Old rows are cleared as new ones arrive.
CREATE TABLE rate_hits (
  key TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX rate_hits_key_idx ON rate_hits (key, at DESC);
