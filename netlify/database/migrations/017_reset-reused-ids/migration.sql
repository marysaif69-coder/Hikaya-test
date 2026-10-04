-- The 4 Oct 2026 restructure reused two ids for different products: 'najdi' was a $24 coffee bag
-- and is now a style (Gulf bag + saffron pack); 'baydani' was a coffee and is now a style (Yemeni
-- bag + Baydani pack). A price, stock, daily limit or cost saved for the old bag must not carry
-- over to the style: clear what was saved before the restructure, keep anything saved after it.
UPDATE product_settings SET price_cents = NULL, stock = NULL, daily_cap = NULL, cost_cents = NULL, available = TRUE
  WHERE product_id IN ('najdi', 'baydani') AND updated_at < '2026-10-04T02:33:00Z';
-- "Email me when it's back" sign-ups were for the old bags.
DELETE FROM stock_alerts WHERE product_id IN ('najdi', 'baydani') AND created_at < '2026-10-04T02:33:00Z' AND notified_at IS NULL;
-- Rows for ids that no longer exist are never read; remove them.
DELETE FROM product_settings WHERE product_id IN ('khaleeji', 'shamaliyya', 'radaey', 'sanaani', 'lev-cardamom', 'lev-plain');
