-- Each login code belongs to the browser that asked for it (a random hk_login cookie, stored
-- hashed), so a stranger's wrong guesses only use up their own codes, never the owner's.
ALTER TABLE auth_codes ADD COLUMN requester_hash TEXT;
