-- =========================================================
-- Scholin — Rotating vacancy banner interval (super admin controlled)
-- Run in Supabase SQL Editor.
--
-- The dashboard's vacancy banner should cycle through multiple open
-- postings rather than always showing the same one. The rotation
-- speed is a platform-wide setting, so it belongs on the existing
-- vacancy_pricing singleton row alongside price_per_day — no new
-- table needed for one more number.
-- =========================================================

alter table vacancy_pricing
  add column if not exists rotation_seconds int not null default 8;

alter table vacancy_pricing
  add constraint vacancy_pricing_rotation_seconds_check
  check (rotation_seconds >= 3 and rotation_seconds <= 120);
