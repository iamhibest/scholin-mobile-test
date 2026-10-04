-- =========================================================
-- Scholin — Online payments in Recent Activity, Stage D1
-- Run in Supabase SQL Editor after school-finance-dashboard-migration.sql.
--
-- Cash/manual payments already create a payment_received activity_log
-- row inside record_event_payment (see
-- activity-log-payments-teachers-migration.sql). Online payments
-- never went through that function — they're created inside
-- apply_event_payment_intent instead — so they've never shown up in
-- Recent Activity until now.
--
-- Same safety property as the cash version: the activity_log insert
-- happens in the SAME function/transaction as the payment itself, so
-- a payment can never be recorded without being logged.
--
-- One difference from the cash version, by design: a cash payment has
-- no "payer" (an admin just types in an amount), so its activity
-- title names the STUDENT. An online payment has a real payer — the
-- parent who tapped Pay Now — so its activity title names the PARENT,
-- e.g. "Mrs Ibraheem paid ₦1,000 for Aisha's Summer Lesson", which is
-- more informative and matches what was actually asked for.
-- =========================================================

-- New column: an unambiguous link from an activity_log row straight to
-- the exact event_payments row it's about — used by the "tap for
-- details" view. (Parsing the receipt number back out of the title
-- text would work too, but this is direct and can't drift.)
alter table activity_log add column if not exists related_payment_id uuid references event_payments(id) on delete set null;

create or replace function apply_event_payment_intent(p_reference text, p_paystack_fee_kobo bigint)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_intent record;
  v_school_id uuid;
  v_event_name text;
  v_student_name text;
  v_parent_name text;
  v_receipt text;
  v_payment_id uuid;
  v_paystack_fee numeric;
  v_platform_fee numeric;
  v_net numeric;
  v_updated_count int;
begin
  select * into v_intent from event_payment_intents where payment_reference = p_reference;

  if v_intent is null then
    return jsonb_build_object('applied', false, 'reason', 'no_matching_intent');
  end if;

  update event_payment_intents
  set payment_status = 'paid'
  where payment_reference = p_reference and payment_status = 'pending';

  get diagnostics v_updated_count = row_count;

  if v_updated_count = 0 then
    return jsonb_build_object('applied', false, 'reason', 'already_applied_or_not_pending');
  end if;

  select school_id into v_school_id from events where id = v_intent.event_id;
  select name into v_event_name from events where id = v_intent.event_id;

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
    platform_fee_amount, net_amount_to_school, paystack_reference,
    commission_amount, paystack_fee_amount
  ) values (
    v_school_id, v_intent.event_id, v_intent.student_id, v_intent.amount, 'online', now(),
    v_receipt, 'valid', null,
    v_platform_fee, v_net, p_reference,
    v_intent.commission_amount, v_paystack_fee
  )
  returning id into v_payment_id;

  select full_name into v_student_name from students where id = v_intent.student_id;
  select full_name into v_parent_name from profiles where id = v_intent.initiated_by;

  insert into activity_log (school_id, activity_type, title, detail, related_student_id, related_event_id, related_payment_id, created_by)
  values (
    v_school_id,
    'payment_received',
    coalesce(v_parent_name, 'A parent') || ' paid ' || to_char(v_intent.amount, 'FM999,999,999')
      || ' for ' || coalesce(v_student_name, 'a student') || '''s ' || coalesce(v_event_name, 'fee'),
    'Paid online · Receipt ' || v_receipt,
    v_intent.student_id,
    v_intent.event_id,
    v_payment_id,
    v_intent.initiated_by
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

-- ---------------------------------------------------------
-- record_event_payment (cash/manual payments) — same change: now
-- also links related_payment_id so the "tap for details" view works
-- identically for both cash and online payments.
-- ---------------------------------------------------------
create or replace function record_event_payment(
  p_event_id uuid,
  p_student_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_notes text,
  p_idempotency_key uuid
)
returns event_payments
language plpgsql
security definer
as $$
declare
  v_school_id uuid;
  v_amount_due numeric;
  v_total_paid numeric;
  v_balance numeric;
  v_receipt text;
  v_row event_payments%rowtype;
  v_caller_authorized boolean;
  v_event_name text;
  v_student_name text;
  v_already_existed boolean := false;
begin
  select e.school_id, e.name into v_school_id, v_event_name from events e where e.id = p_event_id and e.deleted_at is null;
  if v_school_id is null then
    raise exception 'Event not found';
  end if;

  select exists (
    select 1 from school_members sm
    where sm.school_id = v_school_id and sm.profile_id = auth.uid() and sm.is_active = true
      and sm.role in ('owner','teacher_admin')
  ) into v_caller_authorized;

  if not v_caller_authorized and not exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true) then
    raise exception 'Not authorized to record payments for this school';
  end if;

  select amount_due into v_amount_due from event_students where event_id = p_event_id and student_id = p_student_id;
  if v_amount_due is null then
    raise exception 'This student is not assigned to this event';
  end if;

  select coalesce(sum(amount), 0) into v_total_paid
  from event_payments
  where event_id = p_event_id and student_id = p_student_id and status = 'valid';

  v_balance := greatest(v_amount_due - v_total_paid, 0);

  if p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  if p_amount > v_balance then
    raise exception 'The amount entered (%) is greater than the student''s outstanding balance (%).', p_amount, v_balance;
  end if;

  v_receipt := generate_receipt_number();

  insert into event_payments (
    school_id, event_id, student_id, amount, payment_method, notes,
    recorded_by, receipt_number, idempotency_key
  ) values (
    v_school_id, p_event_id, p_student_id, p_amount, coalesce(p_payment_method, 'cash'), p_notes,
    auth.uid(), v_receipt, p_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning * into v_row;

  if v_row.id is null and p_idempotency_key is not null then
    select * into v_row from event_payments where idempotency_key = p_idempotency_key;
    v_already_existed := true;
  end if;

  if not v_already_existed then
    select full_name into v_student_name from students where id = p_student_id;

    insert into activity_log (school_id, activity_type, title, detail, related_student_id, related_event_id, related_payment_id, created_by)
    values (
      v_school_id,
      'payment_received',
      coalesce(v_student_name, 'A student') || ' paid ' || to_char(p_amount, 'FM999,999,999') || ' for ' || coalesce(v_event_name, 'an event'),
      'Receipt ' || v_receipt,
      p_student_id,
      p_event_id,
      v_row.id,
      auth.uid()
    );
  end if;

  return v_row;
end;
$$;
