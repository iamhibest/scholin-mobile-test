-- =========================================================
-- Scholin — Activity logging hooks: payments + teacher acceptance
--
-- Run this AFTER activity-log-migration.sql (the activity_log table
-- must exist first). Safe to run even if you've already run
-- events-fees-migration.sql — CREATE OR REPLACE FUNCTION does not
-- fail on an existing function the way CREATE TABLE does on an
-- existing table, so this is not a duplicate-run risk.
-- =========================================================

-- ---------------------------------------------------------
-- 1. record_event_payment: now also inserts a payment_received
--    activity_log row in the same transaction as the payment itself,
--    so a payment can never be recorded without being logged (or vice
--    versa) — this is safer than logging it from client-side JS after
--    the RPC call returns, since a network drop between the RPC
--    succeeding and a follow-up client insert could otherwise lose
--    the activity entry while the real payment still went through.
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

  -- Only log an activity row for a genuinely NEW payment — a retried/
  -- duplicate idempotent request that returned an existing row must
  -- not create a second activity entry for the same real-world payment.
  if not v_already_existed then
    select full_name into v_student_name from students where id = p_student_id;

    insert into activity_log (school_id, activity_type, title, detail, related_student_id, related_event_id, created_by)
    values (
      v_school_id,
      'payment_received',
      coalesce(v_student_name, 'A student') || ' paid ' || to_char(p_amount, 'FM999,999,999') || ' for ' || coalesce(v_event_name, 'an event'),
      'Receipt ' || v_receipt,
      p_student_id,
      p_event_id,
      auth.uid()
    );
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------
-- 2. accept_teacher_join_request: logs a teacher_join_accepted
--    activity row when a school owner/admin approves a teacher's
--    request to join. Wired into admin-teachers.html in place of the
--    previous direct UPDATE, so acceptance and logging always happen
--    together as one atomic action.
-- ---------------------------------------------------------
create or replace function accept_teacher_join_request(p_membership_id uuid)
returns school_members
language plpgsql
security definer
as $$
declare
  v_row school_members%rowtype;
  v_school_id uuid;
  v_caller_authorized boolean;
  v_teacher_name text;
begin
  select school_id into v_school_id from school_members where id = p_membership_id;
  if v_school_id is null then
    raise exception 'Membership request not found';
  end if;

  select exists (
    select 1 from school_members sm
    where sm.school_id = v_school_id and sm.profile_id = auth.uid() and sm.is_active = true
      and sm.role in ('owner','teacher_admin')
  ) into v_caller_authorized;

  if not v_caller_authorized and not exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true) then
    raise exception 'Not authorized to approve teachers for this school';
  end if;

  update school_members set is_active = true where id = p_membership_id returning * into v_row;

  select full_name into v_teacher_name from profiles where id = v_row.profile_id;

  insert into activity_log (school_id, activity_type, title, detail, created_by)
  values (
    v_school_id,
    'teacher_join_accepted',
    coalesce(v_teacher_name, 'A teacher') || ' was accepted to join the school',
    null,
    auth.uid()
  );

  return v_row;
end;
$$;
