-- Pack v12 (8 Oct 2026): the date boxes hold dates only. Coffee & Dates is a pouch beside a 12-date box (D12 grid)
-- in our paper bag; Two Coffees is two pouches in the bag, with no box. Keys stay the same; boxC12 is the 12-date box.
UPDATE supplies SET name = 'Gift boxes, D24 grid (24 dates)' WHERE key = 'boxD24';
UPDATE supplies SET name = 'Gift boxes, D12 grid (12 dates, Coffee & Dates too)' WHERE key = 'boxC12';
UPDATE supplies SET name = 'Red bands (B4)' WHERE key = 'sleeveRegular';
DELETE FROM supplies WHERE key = 'boxC2';
