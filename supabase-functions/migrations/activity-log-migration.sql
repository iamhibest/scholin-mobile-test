-- =========================================================
-- Scholin — Activity Log (dashboard Recent Activity feed)
--
-- Records discrete events for the owner/admin and teacher dashboards'
-- "Recent Activity" sections: report cards published to parents, fee/
-- event payments received, a teacher's join request being accepted,
-- and school announcements posted. Each row belongs to exactly one
-- school and one activity_type.
--
-- STRICT SCHOOL ISOLATION (2026-08-28): the read policy below
-- deliberately does NOT use the pattern found elsewhere in this
-- codebase ("any school_members row where profile_id = auth.uid()
-- and is_active = true"). That pattern grants access based on ANY
-- membership, which is a weaker guarantee than what was explicitly
-- requested: a teacher who belongs to both School A and School B
-- must ONLY ever see School A's data while School A is their
-- currently active school (profiles.active_school_id), never School
-- B's, regardless of what the client asks for. So this policy checks
-- the row's school_id against profiles.active_school_id specifically,
-- enforced at the database level — not just relied upon via "the
-- client only ever queries the active school." Switching schools
-- (switchActiveSchool(), already used by the sidebar) updates
-- active_school_id, which immediately and correctly changes what
-- this policy allows.
-- =========================================================

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  activity_type text not null check (activity_type in (
    'report_card_published',
    'payment_received',
    'teacher_join_accepted',
    'announcement_posted'
  )),
  title text not null,
  detail text,
  related_student_id uuid references students(id) on delete set null,
  related_term_id uuid references terms(id) on delete set null,
  related_event_id uuid references events(id) on delete set null,
  related_announcement_id uuid references announcements(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index activity_log_school_created_idx on activity_log(school_id, created_at desc);
create index activity_log_school_type_created_idx on activity_log(school_id, activity_type, created_at desc);

alter table activity_log enable row level security;

-- Staff read: owner/teacher_admin see every activity type for their
-- CURRENTLY ACTIVE school. Plain teachers see only
-- report_card_published and announcement_posted for their currently
-- active school — payment and teacher-approval activity is
-- deliberately withheld from teachers per explicit product
-- requirement, not just hidden in the UI.
create policy "Staff read activity for their active school, role-scoped"
on activity_log
for select
using (
  exists (
    select 1
    from profiles p
    join school_members sm on sm.school_id = p.active_school_id and sm.profile_id = p.id
    where p.id = auth.uid()
      and sm.is_active = true
      and sm.school_id = activity_log.school_id
      and (
        sm.role in ('owner', 'teacher_admin')
        or activity_log.activity_type in ('report_card_published', 'announcement_posted')
      )
  )
  or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true)
);

-- Insert: any active member of the school this row is being logged
-- for. Inserts happen from the same app code that performs the
-- underlying action (publishing a report card, recording a payment,
-- accepting a teacher, posting an announcement), immediately after
-- that action succeeds, scoped to the school the action was actually
-- just performed in.
create policy "School members log activity for their school"
on activity_log
for insert
with check (
  exists (
    select 1 from school_members sm
    where sm.profile_id = auth.uid()
      and sm.school_id = activity_log.school_id
      and sm.is_active = true
  )
  or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin = true)
);
