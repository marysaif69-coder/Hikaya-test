-- What each product costs to make (beans or dates, pouch or box, label), for margins in Numbers,
-- and gift cards sold in person (who sold it).

ALTER TABLE product_settings ADD COLUMN cost_cents INT;   -- NULL = not entered yet
ALTER TABLE gift_cards ADD COLUMN sold_by TEXT;          -- set when sold from the desk in person
