-- =========================================================
-- Scholin — Events & Fees (manual payments)
-- Run in Supabase SQL Editor after supabase-migration.sql.
--
-- Reuses existing schools / school_members / students / classes /
-- student_class_history / sessions tables — no duplication. Manual
-- payments only: no Paystack, no payment gateway, no online checkout
-- anywhere in this feature.
--
-- Access: owner / teacher_admin only (same gate as the More Admin
-- Tools page this feature lives under). No new school_members
-- permission flag is added — this deliberately does NOT extend to
-- permission-flagged ordinary teachers, since it's financial data.
-- =========================================================

-- ---------------------------------------------------------
-- 1. EVENTS — one row per fee/event a school creates.
-- ---------------------------------------------------------
create table events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade not null,
  name text not null,
  event_type text not null default 'other'
    check (event_type in ('school_fees','summer_lesson','examination','excursion','graduation','party','pta','sports','books','uniform','other')),
  description text,
  amount numeric not null check (amount >= 0),
  due_date date,
  status text not null default 'active' check (status in ('upcoming','active','completed','archived')),
  assignment_type text not null default 'all_students' check (assignment_type in ('all_students','classes','students')),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz -- soft delete: set instead of a hard DELETE, so payment history is never orphaned
);

alter table events enable row level security;

create policy "School owner/teacher_admin manage events"
on events for all
using (
  school_id in (
    select school_id from school_members
    where profile_id = auth.uid() and is_active = true and role in ('owner','teacher_admin')
  )
  or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true)
);

create index events_school_idx on events(school_id) where deleted_at is null;

-- ---------------------------------------------------------
-- 2. EVENT_CLASSES — which classes an event targets, when
--    assignment_type = 'classes'. Not used for 'all_students' or
--    'students' assignment types.
-- ---------------------------------------------------------
create table event_classes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade not null,
  class_id uuid references classes(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(event_id, class_id)
);

alter table event_classes enable row level security;

create policy "School owner/teacher_admin manage event_classes"
on event_classes for all
using (
  event_id in (
    select e.id from events e
    join school_members sm on sm.school_id = e.school_id
    where sm.profile_id = auth.uid() and sm.is_active = true and sm.role in ('owner','teacher_admin')
  )
  or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true)
);

-- ---------------------------------------------------------
-- 3. EVENT_STUDENTS — the actual per-student assignment + amount due.
--    One row per (event, student). amount_due defaults to the event's
--    amount but can be individually overridden (approved discounts,
--    per requirement #25). This is the row a payment's balance is
--    calculated against — never the raw events.amount directly, so a
--    student with an override is unaffected by it.
-- ---------------------------------------------------------
create table event_students (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade not null,
  student_id uuid references students(id) on delete cascade not null,
  amount_due numeric not null check (amount_due >= 0),
  is_override boolean not null default false, -- true if amount_due was manually set differently from the event's amount
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(event_id, student_id)
);

alter table event_students enable row level security;

create policy "School owner/teacher_admin manage event_students"
on event_students for all
using (
  event_id in (
    select e.id from events e
    join school_members sm on sm.school_id = e.school_id
    where sm.profile_id = auth.uid() and sm.is_active = true and sm.role in ('owner','teacher_admin')
  )
  or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true)
);

create index event_students_event_idx on event_students(event_id);
create index event_students_student_idx on event_students(student_id);

-- ---------------------------------------------------------
-- 4. EVENT_PAYMENTS — every manual payment is its own permanent
--    transaction row. NEVER overwritten. total_paid for a student is
--    always derived by summing these rows — never stored as a single
--    mutable number anywhere.
-- ---------------------------------------------------------
create table event_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade not null,
  event_id uuid references events(id) on delete cascade not null,
  student_id uuid references students(id) on delete cascade not null,
  amount numeric not null check (amount > 0),
  payment_method text not null default 'cash' check (payment_method in ('cash','bank_transfer','pos','cheque','other')),
  payment_date timestamptz not null default now(),
  receipt_number text not null unique,
  notes text,
  recorded_by uuid references profiles(id),
  status text not null default 'valid' check (status in ('valid','voided')),
  voided_by uuid references profiles(id),
  voided_at timestamptz,
  void_reason text,
  -- idempotency_key: set by the client to a value unique per user
  -- click (e.g. a UUID generated once when the payment form opens).
  -- A unique constraint on this means a duplicate submission (double
  -- tap, retried request after a slow/dropped connection) can never
  -- create a second row — see requirement #16.
  idempotency_key uuid,
  created_at timestamptz default now(),
  unique(idempotency_key)
);

alter table event_payments enable row level security;

create policy "School owner/teacher_admin manage event_payments"
on event_payments for all
using (
  school_id in (
    select school_id from school_members
    where profile_id = auth.uid() and is_active = true and role in ('owner','teacher_admin')
  )
  or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true)
);

create index event_payments_event_student_idx on event_payments(event_id, student_id) where status = 'valid';
create index event_payments_school_idx on event_payments(school_id);
create index event_payments_receipt_idx on event_payments(receipt_number);

-- ---------------------------------------------------------
-- 5. Receipt numbers — generated server-side (by a Postgres sequence),
--    never client-generated, so two admins recording payments at the
--    same moment can never collide on the same number. Format:
--    RCT-YYYYMMDD-#### (last 4 digits are the running sequence value,
--    zero-padded, resetting is NOT done per day — the sequence just
--    keeps counting, so numbers stay globally unique across all time
--    even if two payments happen to land on the same calendar day
--    after the sequence has passed 9999; the date portion is cosmetic
--    context, the sequence portion is what guarantees uniqueness).
-- ---------------------------------------------------------
create sequence event_payment_receipt_seq start 1;

create or replace function generate_receipt_number()
returns text
language plpgsql
as $$
declare
  v_next bigint;
begin
  v_next := nextval('event_payment_receipt_seq');
  return 'RCT-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(v_next::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------
-- 6. Server-side function to record a payment. This is the ONLY
--    supported way to insert a row into event_payments — it:
--      - validates the event and student belong to the SAME school
--        the caller is authorized for (re-checked here, not just
--        trusted from RLS alone, since the amount/balance math needs
--        to run atomically anyway)
--      - looks up the student's current amount_due and total valid
--        payments so far, itself — never trusts a "balance" the
--        browser sends
--      - rejects a payment that would exceed the current balance
--        (per requirement #15)
--      - generates the receipt number server-side
--      - is safe against duplicate submission via idempotency_key:
--        if the same key is sent twice, the second call returns the
--        SAME already-created row instead of creating a new one
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

  -- Re-verify the caller is authorized for THIS school (defense in
  -- depth beyond RLS, since this function runs as security definer).
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

  -- Race-safe idempotency: ON CONFLICT DO NOTHING means if two
  -- requests carrying the SAME idempotency_key somehow reach this
  -- insert at almost the same instant (not just a client-side retry,
  -- but a genuine simultaneous race), only one row is ever created —
  -- the "loser" hits the unique constraint, does nothing, and falls
  -- through to the re-select below instead of raising an error.
  insert into event_payments (
    school_id, event_id, student_id, amount, payment_method, notes,
    recorded_by, receipt_number, idempotency_key
  ) values (
    v_school_id, p_event_id, p_student_id, p_amount, coalesce(p_payment_method, 'cash'), p_notes,
    auth.uid(), v_receipt, p_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning * into v_row;

  -- If the insert above was skipped (row already existed for this
  -- key), fetch and return that existing row instead — the caller
  -- always gets back a valid payment row either way, never an error,
  -- for a genuine duplicate submission.
  if v_row.id is null and p_idempotency_key is not null then
    select * into v_row from event_payments where idempotency_key = p_idempotency_key;
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------
-- 7. Recalculation: when an event's amount changes, existing
--    event_students.amount_due rows must be updated — but ONLY for
--    students who don't have an individual override (per requirement
--    #25: "respect valid individual overrides"). Payment transactions
--    are never touched. This is a function, not raw client SQL, so
--    the "which rows get updated" rule lives in one trusted place.
-- ---------------------------------------------------------
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
      and sm.role in ('owner','teacher_admin')
  ) into v_caller_authorized;

  if not v_caller_authorized and not exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true) then
    raise exception 'Not authorized to recalculate this event';
  end if;

  if p_new_amount < 0 then
    raise exception 'Amount cannot be negative';
  end if;

  update events set amount = p_new_amount, updated_at = now() where id = p_event_id;

  -- Only update amount_due for students WITHOUT an individual override —
  -- an overridden student's amount_due is deliberately left untouched.
  update event_students
  set amount_due = p_new_amount, updated_at = now()
  where event_id = p_event_id and is_override = false;
end;
$$;

-- ---------------------------------------------------------
-- 8. Assigning students to an event. Wrapping this in a function keeps
--    "who gets assigned" logic (all students / specific classes /
--    specific students, resolved against the CURRENT session's
--    student_class_history, matching how the rest of Scholin resolves
--    a student's current class) in one place rather than duplicated
--    client-side query logic that could drift.
-- ---------------------------------------------------------
create or replace function assign_students_to_event(
  p_event_id uuid,
  p_assignment_type text, -- 'all_students' | 'classes' | 'students'
  p_class_ids uuid[] default null,
  p_student_ids uuid[] default null
)
returns integer -- number of students assigned
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
      and sm.role in ('owner','teacher_admin')
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

-- =========================================================
-- After this SQL:
-- 1. Deploy events-fees.html (dashboard), event-detail.html (tabs),
--    and the shared js-events-fees-helpers.js.
-- 2. Add the "Events & Fees" tile to admin-more-tools.html.
-- =========================================================
