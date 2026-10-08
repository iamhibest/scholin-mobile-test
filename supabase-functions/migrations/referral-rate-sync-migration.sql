-- =====================================================================
-- Scholin: make the Super Admin referral commission rate really apply
-- Run once in the Supabase SQL editor. Safe to run more than once.
--
-- THE PROBLEM
-- When a school registers with a referral code, the database copies the
-- commission rate of that moment onto the school's own referral record
-- (referrals.commission_per_month). Every payment from that school is then
-- paid at the COPIED rate. Changing the rate in Super Admin only changed
-- the setting, never the copies, so already referred schools kept the old
-- number (for example 500 x 4 months = 2000, even after you set 1.5).
--
-- THE FIX
-- 1. Bring every existing referral record up to the current rate now.
-- 2. From now on, whenever the Super Admin saves a new rate, every
--    referral record follows it straight away.
-- Money already earned is never changed by this (see the optional step).
-- =====================================================================

-- The rate you set in Super Admin (most recently saved row, if there is ever more than one).
create or replace function current_referral_rate()
returns numeric
language sql
stable
as $$
  select referral_commission_per_month
  from app_settings
  order by updated_at desc nulls last
  limit 1
$$;

-- 1. Catch up every referral record now.
update referrals
set commission_per_month = current_referral_rate()
where id is not null
  and current_referral_rate() is not null;

-- 2. Keep them in step from now on.
create or replace function sync_referral_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.referral_commission_per_month is distinct from OLD.referral_commission_per_month then
    update referrals
    set commission_per_month = NEW.referral_commission_per_month
    where id is not null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists sync_referral_rate_trg on app_settings;
create trigger sync_referral_rate_trg
  after update on app_settings
  for each row execute function sync_referral_rate();

-- ---------------------------------------------------------------------
-- To check it worked, run these two lines. Both numbers should match what
-- you set (for example 1.5):
--   select referral_commission_per_month from app_settings;
--   select distinct commission_per_month from referrals;
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- OPTIONAL: correct commission rows that were already created at the old rate
-- and have NOT been paid out yet (status 'pending'). Useful for test data like
-- the 2000 you saw. Paid rows are never touched. To use it, remove the two
-- dashes at the start of each line below and run it.
--
--   update referral_commissions
--   set commission_amount = coalesce(months_covered, 0) * current_referral_rate()
--   where status = 'pending'
--     and current_referral_rate() is not null;
-- ---------------------------------------------------------------------
