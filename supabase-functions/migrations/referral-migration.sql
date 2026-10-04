-- =========================================================
-- Scholin — Referral System
-- Run in Supabase SQL Editor.
--
-- Purely additive: no existing table's behavior changes, no existing
-- column is touched. Every current feature keeps working exactly as
-- it does today.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Every user gets a unique referral code automatically.
--    The DEFAULT generates it at insert time, so this works for every
--    existing signup path without any app code changes — including
--    ones not covered in this conversation. Existing users get one
--    backfilled below.
-- ---------------------------------------------------------
alter table profiles add column referral_code text unique
  default upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

alter table profiles add column bank_account_number text;
alter table profiles add column bank_account_name text;
alter table profiles add column bank_name text;

-- Backfill codes for any profiles that already existed before this migration.
update profiles set referral_code = upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6))
where referral_code is null;

-- ---------------------------------------------------------
-- 2. Schools track who referred them (optional, set at registration).
-- ---------------------------------------------------------
alter table schools add column referred_by_code text;
alter table schools add column is_subscribed boolean not null default false;
alter table schools add column subscription_amount numeric;
alter table schools add column subscribed_at timestamptz;

-- ---------------------------------------------------------
-- 3. Platform-wide commission rate, set by Super Admin.
-- ---------------------------------------------------------
alter table app_settings add column referral_commission_percent numeric not null default 10;

-- ---------------------------------------------------------
-- 4. Referral commissions — one row per subscribed referred school.
-- ---------------------------------------------------------
create table referral_commissions (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references profiles(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  subscription_amount numeric not null,
  commission_percent numeric not null,
  commission_amount numeric not null,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  created_at timestamptz default now(),
  paid_at timestamptz,
  unique(school_id) -- one commission record per school (its one subscription event)
);

alter table referral_commissions enable row level security;

-- A referrer can see their own commission records (their payment history).
-- Only super admin can create/update — commissions are only ever created
-- when super admin marks a school subscribed, and only super admin marks
-- them paid. This stops anyone from crediting themselves a fake commission.
create policy "Referrers read their own commissions"
on referral_commissions for select
using (
  referrer_id = auth.uid()
  or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true)
);

-- No client insert/update policy — all writes happen from the super admin
-- pages using the super admin's own authenticated session, which is
-- already gated by is_super_admin checks in the app itself. For extra
-- safety, add an explicit super-admin-only write policy:
create policy "Only super admin writes commissions"
on referral_commissions for all
using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true))
with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true));

create index referral_commissions_referrer_idx on referral_commissions(referrer_id, status);
