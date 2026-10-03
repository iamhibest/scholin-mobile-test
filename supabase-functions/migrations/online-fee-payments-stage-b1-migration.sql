-- =========================================================
-- Scholin — Online fee payments, Stage B1 (schema only)
-- Run in Supabase SQL Editor after school-payout-account-migration.sql.
--
-- No money moves as a result of this file. It only adds:
--   1. event_payment_intents — a row created BEFORE Paystack is ever
--      told about a payment attempt, same pattern as your existing
--      subscription/vacancy payments (a row must already exist for
--      the webhook or verify call to apply anything to).
--   2. apply_event_payment_intent — the ONE place a pending intent
--      ever becomes a real, confirmed row in event_payments. Atomic
--      and idempotent: whichever caller (webhook or browser-triggered
--      verify) reaches a given reference first wins; the other does
--      nothing further. No double-charging, no double-commission.
-- =========================================================

-- event_payments currently only allows manually-recorded payment
-- methods — 'online' is a new one, for a payment that came through
-- Paystack rather than an admin typing it in.
alter table event_payments drop constraint if exists event_payments_payment_method_check;
alter table event_payments add constraint event_payments_payment_method_check
  check (payment_method in ('cash','bank_transfer','pos','cheque','other','online'));

-- ---------------------------------------------------------
-- EVENT_PAYMENT_INTENTS
-- ---------------------------------------------------------
create table if not exists event_payment_intents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade not null,
  student_id uuid references students(id) on delete cascade not null,
  initiated_by uuid references profiles(id) not null,
  amount numeric not null check (amount > 0),
  commission_amount numeric not null default 0,
  payment_reference text unique not null,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed')),
  created_at timestamptz default now()
);

alter table event_payment_intents enable row level security;

-- A parent may only ever SEE their own payment attempts. No insert,
-- update, or delete policy exists for regular users at all — every
-- write to this table happens through an Edge Function using the
-- service role, which bypasses RLS entirely. This is deliberate: a
-- parent's browser can never mark its own payment "paid".
create policy "Parent reads their own payment intents"
on event_payment_intents for select
using (initiated_by = auth.uid());

-- ---------------------------------------------------------
-- apply_event_payment_intent — the single, atomic, idempotent apply.
-- p_paystack_fee_kobo is Paystack's OWN processing fee for this exact
-- transaction (from event.data.fees on the webhook/verify response,
-- in kobo) — not knowable in advance, only after the charge actually
-- completes, which is why it's a parameter here rather than something
-- computed at intent-creation time.
-- ---------------------------------------------------------
create or replace function apply_event_payment_intent(p_reference text, p_paystack_fee_kobo bigint)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_intent record;
  v_school_id uuid;
  v_receipt text;
  v_paystack_fee numeric;
  v_platform_fee numeric;
  v_net numeric;
  v_updated_count int;
begin
  select * into v_intent from event_payment_intents where payment_reference = p_reference;

  if v_intent is null then
    return jsonb_build_object('applied', false, 'reason', 'no_matching_intent');
  end if;

  -- Race-safe conditional update: only succeeds for whichever caller
  -- gets here first while the row is still 'pending'. A second caller
  -- (e.g. the webhook arriving moments after the browser's own verify
  -- call already handled it) updates zero rows and stops here.
  update event_payment_intents
  set payment_status = 'paid'
  where payment_reference = p_reference and payment_status = 'pending';

  get diagnostics v_updated_count = row_count;

  if v_updated_count = 0 then
    return jsonb_build_object('applied', false, 'reason', 'already_applied_or_not_pending');
  end if;

  select school_id into v_school_id from events where id = v_intent.event_id;
  if v_school_id is null then
    return jsonb_build_object('applied', false, 'reason', 'event_not_found');
  end if;

  v_paystack_fee := coalesce(p_paystack_fee_kobo, 0) / 100.0;
  v_platform_fee := v_intent.commission_amount + v_paystack_fee;
  v_net := v_intent.amount - v_platform_fee;

  v_receipt := generate_receipt_number();

  insert into event_payments (
    school_id, event_id, student_id, amount, payment_method, payment_date,
    receipt_number, status, recorded_by,
    platform_fee_amount, net_amount_to_school, paystack_reference
  ) values (
    v_school_id, v_intent.event_id, v_intent.student_id, v_intent.amount, 'online', now(),
    v_receipt, 'valid', null,
    v_platform_fee, v_net, p_reference
  );

  return jsonb_build_object(
    'applied', true,
    'receipt_number', v_receipt,
    'amount', v_intent.amount,
    'platform_fee_amount', v_platform_fee,
    'net_amount_to_school', v_net
  );
end;
$$;

-- =========================================================
-- After this SQL:
-- Stage B2 (create-fee-payment Edge Function) and B3
-- (verify-fee-payment + webhook update) are next — this file alone
-- does not let anyone pay yet.
-- =========================================================
