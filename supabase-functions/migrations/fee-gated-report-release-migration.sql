-- =========================================================
-- Scholin — Fee-gated report card release
-- Run in Supabase SQL Editor after events-fees-migration.sql.
--
-- Lets a school hold back a student's report card from their parent
-- until mandatory fees for that term are fully paid, with a school-wide
-- on/off toggle and a manual per-student override for edge cases.
-- =========================================================

-- 1. Mark a fee/event as mandatory (blocks report card release when
--    unpaid) or optional (never blocks anything, just tracked as
--    normal). Existing events default to mandatory so behavior for
--    schools that never touch this stays unchanged until they turn
--    the school-wide toggle on below.
alter table events add column if not exists is_mandatory boolean not null default true;

-- 2. Which term a fee belongs to, for report-card gating purposes. A
--    fee with no term set is never considered when checking whether a
--    student's report card for a specific term should be released —
--    only fees explicitly tied to that term can block it. This keeps
--    one-off fees (uniforms, an excursion with no fixed term) from
--    ever accidentally blocking results.
alter table events add column if not exists term_id uuid references terms(id);

-- 3. School-wide switch. Off by default — nothing changes for a
--    school until they explicitly turn this on in school settings.
alter table schools add column if not exists fee_gated_report_release boolean not null default false;

-- ---------------------------------------------------------
-- 4. STUDENT_REPORT_MANUAL_RELEASE — admin's manual override to
--    release one student's report card for one term regardless of
--    fee status (e.g. a payment glitch, a discount, a special case).
-- ---------------------------------------------------------
create table student_report_manual_release (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade not null,
  term_id uuid references terms(id) on delete cascade not null,
  released_by uuid references profiles(id),
  released_at timestamptz default now(),
  unique(student_id, term_id)
);

alter table student_report_manual_release enable row level security;

create policy "School owner/teacher_admin manage manual releases"
on student_report_manual_release for all
using (
  student_id in (
    select st.id from students st
    join school_members sm on sm.school_id = st.school_id
    where sm.profile_id = auth.uid() and sm.is_active = true and sm.role in ('owner','teacher_admin')
  )
  or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true)
)
with check (
  student_id in (
    select st.id from students st
    join school_members sm on sm.school_id = st.school_id
    where sm.profile_id = auth.uid() and sm.is_active = true and sm.role in ('owner','teacher_admin')
  )
  or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true)
);

-- ---------------------------------------------------------
-- 5. get_report_release_status — single source of truth for "can this
--    student's report card for this term be shown to their parent".
--    security definer so a parent can call it safely without needing
--    broad read access to events/event_students/event_payments —
--    they only ever get back a name and an outstanding balance, never
--    full financial rows. Called from both the admin publish page
--    (to show who is blocked) and the parent dashboard (to gate and
--    explain).
-- ---------------------------------------------------------
create or replace function get_report_release_status(p_student_id uuid, p_term_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_school_id uuid;
  v_gated boolean;
  v_manual_release boolean;
  v_outstanding jsonb;
  v_authorized boolean;
begin
  select school_id into v_school_id from students where id = p_student_id;
  if v_school_id is null then
    return jsonb_build_object('unlocked', true, 'outstanding', '[]'::jsonb);
  end if;

  -- Only three callers may ever learn a student's fee/report status:
  -- a staff member of that student's school, a parent linked to that
  -- specific student, or a super admin. Security definer means this
  -- function bypasses normal RLS, so this check is the only thing
  -- standing between "any logged-in user" and "someone else's child's
  -- financial status" — it is not optional.
  select exists (
    select 1 from school_members sm
    where sm.school_id = v_school_id and sm.profile_id = auth.uid() and sm.is_active = true
  ) or exists (
    select 1 from parent_student_links psl
    where psl.student_id = p_student_id and psl.parent_id = auth.uid()
  ) or exists (
    select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true
  ) into v_authorized;

  if not v_authorized then
    raise exception 'Not authorized to view this student''s report release status';
  end if;

  select coalesce(fee_gated_report_release, false) into v_gated from schools where id = v_school_id;

  if not v_gated then
    return jsonb_build_object('unlocked', true, 'outstanding', '[]'::jsonb);
  end if;

  select exists (
    select 1 from student_report_manual_release
    where student_id = p_student_id and term_id = p_term_id
  ) into v_manual_release;

  if v_manual_release then
    return jsonb_build_object('unlocked', true, 'outstanding', '[]'::jsonb, 'manually_released', true);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('name', row_data.name, 'balance', row_data.balance)), '[]'::jsonb)
  into v_outstanding
  from (
    select
      e.name as name,
      greatest(es.amount_due - coalesce((
        select sum(ep.amount) from event_payments ep
        where ep.event_id = e.id and ep.student_id = p_student_id and ep.status = 'valid'
      ), 0), 0) as balance
    from events e
    join event_students es on es.event_id = e.id and es.student_id = p_student_id
    where e.term_id = p_term_id
      and e.is_mandatory = true
      and e.deleted_at is null
  ) row_data
  where row_data.balance > 0;

  return jsonb_build_object('unlocked', jsonb_array_length(v_outstanding) = 0, 'outstanding', v_outstanding);
end;
$$;

grant execute on function get_report_release_status(uuid, uuid) to authenticated;

-- =========================================================
-- After this SQL:
-- 1. Deploy the updated events-fees.html, event-detail.html,
--    admin-school-settings.html, class-report-publish.html,
--    parent-dashboard.html, and parent-fee-detail.html.
-- =========================================================
