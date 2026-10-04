-- =========================================================
-- Scholin — Recent Activity: make every activity type tappable
--
-- payment_received and announcement_posted already link to a real
-- row (related_payment_id, related_announcement_id) and are already
-- tappable in the app. report_card_published already links to
-- related_term_id, so it needs no schema change. teacher_join_accepted
-- had no related id at all — this adds one.
-- =========================================================

alter table activity_log add column if not exists related_membership_id uuid references school_members(id) on delete set null;

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

  insert into activity_log (school_id, activity_type, title, detail, related_membership_id, created_by)
  values (
    v_school_id,
    'teacher_join_accepted',
    coalesce(v_teacher_name, 'A teacher') || ' was accepted to join the school',
    null,
    v_row.id,
    auth.uid()
  );

  return v_row;
end;
$$;
