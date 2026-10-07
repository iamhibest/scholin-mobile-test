-- =====================================================================
-- Scholin: a second phone number for each school (run once in the SQL editor)
-- Both numbers show on receipts and report cards.
-- =====================================================================
alter table schools add column if not exists phone_2 text;
