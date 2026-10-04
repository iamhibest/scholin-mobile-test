-- =========================================================
-- Scholin — "Clock a Friend" (proxy clock-in/out) support
-- Run in Supabase SQL Editor, after staff-attendance-migration.sql
--
-- Lets one teacher clock another teacher in/out (e.g. low battery,
-- phone issues) while still requiring the same QR + GPS + live
-- camera checks at the moment of clocking. The admin-facing record
-- looks identical to a normal self clock-in; the proxy_user_id
-- column is a quiet internal audit trail only, in case a clock-in
-- is ever disputed.
-- =========================================================

alter table staff_attendance add column clock_in_proxy_user_id uuid references profiles(id);
alter table staff_attendance add column clock_out_proxy_user_id uuid references profiles(id);

-- No new RLS policy needed — staff_attendance already has no direct
-- client insert/update policy; all writes still go through the
-- record-attendance Edge Function using the service role key.
