-- =========================================================
-- Scholin — Restrictable "Manage Events & Fees" permission
-- Run in Supabase SQL Editor AFTER events-fees-migration.sql.
--
-- Every other toggle on the Permissions panel (can_edit_results,
-- can_mark_attendance, etc.) works as an ADDITIVE grant: it extends
-- a plain teacher's access, while owner/teacher_admin always pass
-- regardless of the toggle. This permission is different on
-- purpose — the school owner explicitly wants the ability to
-- RESTRICT a teacher_admin's access to Events & Fees, not just
-- extend a teacher's. So the rule here is:
--   owner            -> always allowed, toggle can't lock them out
--   teacher_admin    -> allowed only if can_manage_events_fees = true
--   plain teacher     -> never allowed (unchanged from before)
--
-- Defaults to true so existing schools aren't silently locked out
-- of a feature they already had access to the moment this ships —
-- the owner has to deliberately turn it off.
--
-- This touches every place that previously checked
-- "role in ('owner','teacher_admin')" for events/fees: 4 RLS
-- policies (events, event_students, event_payments) and 3
-- security-definer functions (record_event_payment,
-- recalculate_event, assign_students_to_event). Missing any one of
-- these would leave a real gap — e.g. hiding the UI but leaving
-- direct payment recording open — so all seven are updated together
-- in this single migration.
-- =========================================================

alter table school_members
  add column if not exists can_manage_events_fees boolean not null default true;

-- ---------------------------------------------------------
-- RLS policies (events, event_students, event_payments)
-- ---------------------------------------------------------

drop policy if exists "School owner/teacher_admin manage events" on events;
create policy "School owner/teacher_admin manage events"
on events for all
using (
  school_id in (
    select school_id from school_members
    where profile_id = auth.uid() and is_active = true
      and (role = 'owner' or (role = 'teacher_admin' and can_manage_events_fees = true))
  )
  or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true)
);

drop policy if exists "School owner/teacher_admin manage event_students" on event_students;
create policy "School owner/teacher_admin manage event_students"
on event_students for all
using (
  event_id in (
    select e.id from events e
    join school_members sm on sm.school_id = e.school_id
    where sm.profile_id = auth.uid() and sm.is_active = true
      and (sm.role = 'owner' or (sm.role = 'teacher_admin' and sm.can_manage_events_fees = true))
  )
  or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true)
);

drop policy if exists "School owner/teacher_admin manage event_payments" on event_payments;
create policy "School owner/teacher_admin manage event_payments"
on event_payments for all
using (
  school_id in (
    select school_id from school_members
    where profile_id = auth.uid() and is_active = true
      and (role = 'owner' or (role = 'teacher_admin' and can_manage_events_fees = true))
  )
  or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true)
);

-- ---------------------------------------------------------
-- Security-definer functions (reissued in full via create or
-- replace — only the authorization check changed, everything else
-- is copied unchanged from events-fees-migration.sql)
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
begin
  select e.school_id into v_school_id from events e where e.id = p_event_id and e.deleted_at is null;
  if v_school_id is null then
    raise exception 'Event not found';
  end if;

  select exists (
    select 1 from school_members sm
    where sm.school_id = v_school_id and sm.profile_id = auth.uid() and sm.is_active = true
      and (sm.role = 'owner' or (sm.role = 'teacher_admin' and sm.can_manage_events_fees = true))
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
  end if;

  return v_row;
end;
$$;

create or replace function recalculate_event(p_event_id uuid, p_new_amount numeric)
returns void
language plpgsql
security definer
as $$
declare
  v_school_id uuid;
  v_caller_authorized boolean;
begin
  select school_id into v_school_id from events where id = p_event_id and deleted_at is null;
  if v_school_id is null then
    raise exception 'Event not found';
  end if;

  select exists (
    select 1 from school_members sm
    where sm.school_id = v_school_id and sm.profile_id = auth.uid() and sm.is_active = true
      and (sm.role = 'owner' or (sm.role = 'teacher_admin' and sm.can_manage_events_fees = true))
  ) into v_caller_authorized;

  if not v_caller_authorized and not exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true) then
    raise exception 'Not authorized to recalculate this event';
  end if;

  if p_new_amount < 0 then
    raise exception 'Amount cannot be negative';
  end if;

  update events set amount = p_new_amount, updated_at = now() where id = p_event_id;

  update event_students
  set amount_due = p_new_amount, updated_at = now()
  where event_id = p_event_id and is_override = false;
end;
$$;

create or replace function assign_students_to_event(
  p_event_id uuid,
  p_assignment_type text,
  p_class_ids uuid[] default null,
  p_student_ids uuid[] default null
)
returns integer
language plpgsql
security definer
as $$
declare
  v_school_id uuid;
  v_amount numeric;
  v_caller_authorized boolean;
  v_current_session_id uuid;
  v_count integer;
begin
  select school_id, amount into v_school_id, v_amount from events where id = p_event_id and deleted_at is null;
  if v_school_id is null then
    raise exception 'Event not found';
  end if;

  select exists (
    select 1 from school_members sm
    where sm.school_id = v_school_id and sm.profile_id = auth.uid() and sm.is_active = true
      and (sm.role = 'owner' or (sm.role = 'teacher_admin' and sm.can_manage_events_fees = true))
  ) into v_caller_authorized;

  if not v_caller_authorized and not exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true) then
    raise exception 'Not authorized to manage this event';
  end if;

  update events set assignment_type = p_assignment_type, updated_at = now() where id = p_event_id;

  if p_assignment_type = 'all_students' then
    insert into event_students (event_id, student_id, amount_due)
    select p_event_id, s.id, v_amount
    from students s
    where s.school_id = v_school_id
    on conflict (event_id, student_id) do nothing;

  elsif p_assignment_type = 'classes' then
    select id into v_current_session_id from sessions where school_id = v_school_id and is_current = true limit 1;

    insert into event_students (event_id, student_id, amount_due)
    select distinct p_event_id, sch.student_id, v_amount
    from student_class_history sch
    where sch.class_id = any(p_class_ids)
      and (v_current_session_id is null or sch.session_id = v_current_session_id)
    on conflict (event_id, student_id) do nothing;

    insert into event_classes (event_id, class_id)
    select p_event_id, unnest(p_class_ids)
    on conflict (event_id, class_id) do nothing;

  elsif p_assignment_type = 'students' then
    insert into event_students (event_id, student_id, amount_due)
    select p_event_id, unnest(p_student_ids), v_amount
    on conflict (event_id, student_id) do nothing;
  end if;

  select count(*) into v_count from event_students where event_id = p_event_id;
  return v_count;
end;
$$;
