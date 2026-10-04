-- Round 3: a season changes the gift box's sleeve, not the product. The sleeve chosen for each
-- gift box line (regular, ramadan, eid); NULL for lines that take no sleeve and for older orders.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sleeve TEXT;
