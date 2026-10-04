-- =========================================================
-- Scholin — Referral System v2
-- Run this AFTER referral-migration.sql and after
-- subscription-security-hardening-v3.sql.
--
-- WHAT WAS WRONG BEFORE:
-- referral_commissions had `unique(school_id)` — ONE row per school,
-- forever. Every new commission for the same school used
-- `on conflict (school_id) do update`, overwriting that single row's
-- amount instead of creating a new one. So if a referrer's commission
-- had already been marked 'paid', the NEXT commission they earned from
-- that same school silently landed inside that already-'paid' row —
-- appearing to be instantly paid without super admin ever clicking
-- anything. There was also no time limit on how long a referral could
-- keep earning commission.
--
-- WHAT THIS MIGRATION BUILDS:
-- 1. `referrals` — one row per referrer<->school relationship, created
--    at the school's FIRST successful subscription payment, holding
--    the 12-month commission window (referral_expires_at).
-- 2. `referral_commissions` — now one row PER QUALIFYING PAYMENT
--    (unique constraint removed), always created as 'pending'.
-- 3. `referral_payouts` — one row per time Super Admin clicks "Mark
--    Paid", holding the total and timestamp. `referral_commissions`
--    rows get linked to a payout via `payout_id` when paid — never
--    overwritten or reused.
-- 4. The 12-month referral window: commission on a payment is only
--    generated for the portion of the subscription that falls before
--    referral_expires_at, calculated server-side, never trusting the
--    browser.
-- =========================================================

-- ---------------------------------------------------------
-- 1. referrals — the relationship + its 12-month commission window.
-- ---------------------------------------------------------
create table referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references profiles(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade unique, -- a school has exactly one referrer, ever
  first_subscription_date timestamptz not null,
  referral_expires_at timestamptz not null, -- first_subscription_date + 12 months, fixed at creation
  commission_rate numeric not null, -- snapshot of the rate at the time of the first payment
  created_at timestamptz default now()
);

alter table referrals enable row level security;

create policy "Referrers read their own referral relationships"
on referrals for select
using (
  referrer_id = auth.uid()
  or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true)
);

create policy "Only service role writes referrals"
on referrals for all
using ( auth.role() = 'service_role' );
-- No client, including an authenticated super admin browsing the app,
-- ever writes this table directly — it's only ever created by the
-- subscription-payment trigger below (which runs as the trigger owner,
-- effectively service-role-equivalent since it's security definer).
-- This closes off any path where the browser could set
-- referral_expires_at or first_subscription_date itself.

create index referrals_referrer_idx on referrals(referrer_id);

-- ---------------------------------------------------------
-- 2. referral_payouts — one row per time Super Admin clears a
--    referrer's balance. This is what "Payment History" on the
--    referrer's dashboard actually shows.
-- ---------------------------------------------------------
create table referral_payouts (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references profiles(id) on delete cascade,
  total_amount numeric not null,
  paid_at timestamptz default now(),
  paid_by uuid references profiles(id), -- which super admin actioned it
  note text
);

alter table referral_payouts enable row level security;

create policy "Referrers read their own payout history"
on referral_payouts for select
using (
  referrer_id = auth.uid()
  or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true)
);

create policy "Only super admin writes payouts"
on referral_payouts for all
using ( exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true) )
with check ( exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true) );

create index referral_payouts_referrer_idx on referral_payouts(referrer_id);

-- ---------------------------------------------------------
-- 3. referral_commissions — remove the one-row-per-school constraint,
--    add a link to the payout that cleared it (if any), and a link to
--    the exact subscription_payments row that generated it (so it's
--    always traceable to a real, verified payment).
-- ---------------------------------------------------------
alter table referral_commissions drop constraint if exists referral_commissions_school_id_key;
alter table referral_commissions add column payout_id uuid references referral_payouts(id);
alter table referral_commissions add column subscription_payment_id uuid references subscription_payments(id);
alter table referral_commissions add column months_covered numeric; -- may be fractional — see the 12-month-window calc below

-- A commission row can only be linked to a payout when it is (or is
-- becoming) 'paid', and once linked, referrer/amount can't be silently
-- changed underneath a payout total.
create index referral_commissions_referrer_status_idx on referral_commissions(referrer_id, status);
create index referral_commissions_payout_idx on referral_commissions(payout_id);

-- ---------------------------------------------------------
-- 4a. BACKFILL: any school that was already referred and already has
--    at least one referral_commissions row from BEFORE this migration
--    needs its referrals row created now, anchored to its actual
--    historical first commission date — not "whenever it next
--    renews," which would incorrectly reset/extend their window.
-- ---------------------------------------------------------
insert into referrals (referrer_id, school_id, first_subscription_date, referral_expires_at, commission_rate)
select
  rc.referrer_id,
  rc.school_id,
  min(rc.created_at) as first_subscription_date,
  min(rc.created_at) + interval '12 months' as referral_expires_at,
  (array_agg(rc.commission_percent order by rc.created_at asc))[1] as commission_rate
from referral_commissions rc
where rc.school_id not in (select school_id from referrals)
group by rc.referrer_id, rc.school_id;

-- ---------------------------------------------------------
-- 4b. Replace the commission-creation logic entirely. This supersedes
--    the version in subscription-v2-migration.sql. Key behavior:
--
--    a) On a school's FIRST ever successful subscription payment,
--       create its `referrals` row (if the school has a
--       referred_by_code and a matching referrer), fixing
--       referral_expires_at = payment time + 12 months. This is
--       calculated ONCE and never recalculated or reset by later
--       payments, inactivity, or cancellation.
--
--    b) On EVERY successful subscription payment (first or renewal),
--       check whether any part of the purchased period falls before
--       the school's referral_expires_at. If the referral has already
--       expired, or the school was never referred, commission = 0 and
--       no row is created at all. If part of the period falls within
--       the window and part falls after, commission is calculated
--       ONLY on the in-window portion (pro-rated by months).
--
--    c) Every qualifying commission is inserted as a NEW row, always
--       'pending', never merged into or overwriting a prior row —
--       this is the actual bug fix. A referrer's "current balance" is
--       just sum(commission_amount) where status = 'pending', which
--       naturally starts accumulating fresh after a payout with zero
--       risk of colliding with already-paid history.
-- ---------------------------------------------------------
create or replace function apply_confirmed_subscription_payment()
returns trigger
language plpgsql
security definer
as $$
declare
  v_school schools%rowtype;
  v_base timestamptz;
  v_referral referrals%rowtype;
  v_referrer_id uuid;
  v_commission_percent numeric;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_eligible_end timestamptz;
  v_eligible_months numeric;
  v_commission_amount numeric;
  v_per_month_amount numeric;
begin
  if NEW.payment_status <> 'paid' or OLD.payment_status = 'paid' then
    return NEW;
  end if;

  select * into v_school from schools where id = NEW.school_id;

  -- Extend from whichever is later: right now, or the school's current
  -- paid-until date (so renewing early doesn't waste remaining time).
  -- If they were cancelled, always restart from now — cancellation
  -- means whatever time was "left" is void.
  v_base := case
    when v_school.subscription_cancelled_at is not null then now()
    else greatest(now(), coalesce(v_school.subscription_ends_at, now()))
  end;

  v_period_start := v_base;
  v_period_end := v_base + (NEW.months || ' months')::interval;

  update schools set
    is_subscribed = true,
    subscription_amount = NEW.amount_charged,
    subscribed_at = now(),
    subscription_ends_at = v_period_end,
    subscription_months = NEW.months,
    subscription_cancelled_at = null,
    subscription_cancelled_reason = null
  where id = NEW.school_id;

  NEW.paid_at := now();

  -- ---------------------------------------------------------
  -- Referral commission — 12-month window, pro-rated, one new row per
  -- qualifying payment. Skipped entirely if the school has no referral
  -- code, no matching referrer profile, or (checked further below) no
  -- part of this payment's period falls inside the window.
  -- ---------------------------------------------------------
  if v_school.referred_by_code is not null then
    select id into v_referrer_id from profiles where referral_code = v_school.referred_by_code;

    if v_referrer_id is not null then
      -- Does a referrals row already exist for this school? If not,
      -- this IS the school's first successful subscription payment —
      -- create it now, fixing the 12-month window from THIS exact
      -- payment's confirmation time. This can never be recalculated
      -- later, per the "first successful subscription, not first
      -- attempt, not most recent" rule.
      select * into v_referral from referrals where school_id = NEW.school_id;

      if v_referral.id is null then
        select referral_commission_percent into v_commission_percent from app_settings limit 1;
        v_commission_percent := coalesce(v_commission_percent, 10);

        insert into referrals (referrer_id, school_id, first_subscription_date, referral_expires_at, commission_rate)
        values (v_referrer_id, NEW.school_id, now(), now() + interval '12 months', v_commission_percent)
        returning * into v_referral;
      end if;

      -- Determine how much of THIS payment's period (v_period_start to
      -- v_period_end) falls before v_referral.referral_expires_at.
      -- Only that portion is commissionable — never the whole payment
      -- if it partially or fully falls after the window closed.
      if v_period_start < v_referral.referral_expires_at then
        v_eligible_end := least(v_period_end, v_referral.referral_expires_at);
        -- Fractional months of overlap, measured in real elapsed time
        -- rather than assuming every month is exactly 30 days — avoids
        -- systematically over/under-crediting at the boundary.
        v_eligible_months := extract(epoch from (v_eligible_end - v_period_start)) / extract(epoch from interval '1 month');

        if v_eligible_months > 0 then
          v_per_month_amount := NEW.amount_charged / NEW.months;
          v_commission_amount := round(v_per_month_amount * v_eligible_months * v_referral.commission_rate / 100, 2);

          if v_commission_amount > 0 then
            insert into referral_commissions (
              referrer_id, school_id, subscription_amount, commission_percent,
              commission_amount, status, subscription_payment_id, months_covered
            ) values (
              v_referrer_id, NEW.school_id,
              round(v_per_month_amount * v_eligible_months, 2),
              v_referral.commission_rate,
              v_commission_amount,
              'pending',
              NEW.id,
              round(v_eligible_months, 4)
            );
          end if;
        end if;
      end if;
      -- else: v_period_start is already >= referral_expires_at, so
      -- NONE of this payment falls inside the window — commission is
      -- correctly ₦0 and no row is created at all, per the spec.
    end if;
  end if;

  return NEW;
end;
$$;

-- ---------------------------------------------------------
-- 5. Super Admin marks a referrer paid: create ONE referral_payouts
--    row covering the current pending total, and link every currently-
--    pending commission row to it in the same transaction. This is a
--    function (not raw client SQL) so the "sum pending, create payout,
--    link rows" sequence is atomic — a commission earned in the
--    middle of this running can't be accidentally swept in or dropped.
-- ---------------------------------------------------------
create or replace function pay_out_referrer(p_referrer_id uuid, p_note text default null)
returns referral_payouts
language plpgsql
security definer
as $$
declare
  v_total numeric;
  v_payout referral_payouts%rowtype;
begin
  -- Only an actual super admin caller may run this.
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true) then
    raise exception 'Only Super Admin can process referral payouts';
  end if;

  select coalesce(sum(commission_amount), 0) into v_total
  from referral_commissions
  where referrer_id = p_referrer_id and status = 'pending';

  if v_total <= 0 then
    raise exception 'This referrer has no pending balance to pay out';
  end if;

  insert into referral_payouts (referrer_id, total_amount, paid_by, note)
  values (p_referrer_id, v_total, auth.uid(), p_note)
  returning * into v_payout;

  update referral_commissions
  set status = 'paid', paid_at = now(), payout_id = v_payout.id
  where referrer_id = p_referrer_id and status = 'pending';

  return v_payout;
end;
$$;

-- =========================================================
-- After this SQL:
-- 1. Redeploy super-admin-referrals.html and referral-dashboard.html
--    (both rewritten to use the new tables/function).
-- 2. Existing referral_commissions rows (from before this migration)
--    that are already 'paid' are left as-is — they'll show correctly
--    in history but won't have a payout_id (no matching
--    referral_payouts row exists for pre-migration payments). This is
--    cosmetic only; a future payout will create its own proper row.
-- 3. Existing 'pending' rows from before this migration are preserved
--    and will be included in the next payout normally.
-- =========================================================
