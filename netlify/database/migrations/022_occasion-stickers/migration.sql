-- Every gift box has the same gold khalal sleeve; Ramadan and Eid are our own Ø50 sticker on it
-- (packaging brief B1). The two seasonal supplies are stickers, not sleeves. Keys stay the same.
UPDATE supplies SET name = 'Ramadan stickers (Ø50)' WHERE key = 'sleeveRamadan';
UPDATE supplies SET name = 'Eid stickers (Ø50)' WHERE key = 'sleeveEid';
