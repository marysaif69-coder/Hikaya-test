-- Who each letter reached, so a letter that partly failed can be sent again to the rest only.
-- letters.status is now draft | sending | partial | sent.
CREATE TABLE letter_sends (
  letter_id INT NOT NULL REFERENCES letters(id),
  email TEXT NOT NULL,
  status TEXT NOT NULL,                      -- sent | failed | skipped
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (letter_id, email)
);
