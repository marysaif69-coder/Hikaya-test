-- Owners and helpers who also deliver (e.g. a co-founder or a manager doing Ramadan deliveries):
-- they keep their desk rights, can be given deliveries and driving shifts, and their licence and
-- insurance are tracked like a driver's.
ALTER TABLE team_members ADD COLUMN drives BOOLEAN NOT NULL DEFAULT FALSE;
