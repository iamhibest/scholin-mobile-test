-- =====================================================================
-- Scholin — Permission lockdown (run once in the Supabase SQL editor)
--
-- Why: the old rule let ANY teacher admin update ANY member row in the
-- school, including their own. Hiding switches in the app is not enough,
-- so this enforces the rules inside the database.
--
-- Rules after this migration
--   School owner : can change anything for everyone in the school.
--   Teacher admin: - can NEVER change their own role, status or permissions
--                  - can NEVER change "Manage events and fees" or
--                    "Manage permissions" for anybody (owner only)
--                  - can NEVER touch the owner
--                  - can Make admin / Remove admin on other people
--                  - can change the other permissions of REGULAR teachers
--                    only if the owner switched on "Manage permissions"
--                    for them
--   Everyone else: cannot change their own role, status or permissions
--   Super admin, SQL editor, edge functions: unchanged (not restricted)
-- =====================================================================

alter table school_members
  add column if not exists can_manage_permissions boolean not null default false;

create or replace function enforce_member_permission_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_super boolean;
  v_role text;
  v_delegated boolean;
  v_old jsonb := to_jsonb(OLD);
  v_new jsonb := to_jsonb(NEW);
  v_col text;
  v_owner_only text[] := array['can_manage_permissions', 'can_manage_events_fees'];
  v_other_perms text[] := array[
    'can_edit_results', 'can_generate_report_cards', 'can_add_comments',
    'can_mark_attendance', 'can_manage_attendance', 'can_manage_qr_codes',
    'can_view_attendance_reports', 'receive_attendance_notifications'
  ];
  v_owner_only_changed boolean := false;
  v_other_changed boolean := false;
begin
  -- SQL editor, service role and edge functions have no logged-in user: allow.
  if v_uid is null then
    return NEW;
  end if;

  select coalesce(is_super_admin, false) into v_is_super from profiles where id = v_uid;
  if coalesce(v_is_super, false) then
    return NEW;
  end if;

  select sm.role, coalesce(sm.can_manage_permissions, false)
    into v_role, v_delegated
  from school_members sm
  where sm.school_id = OLD.school_id and sm.profile_id = v_uid and sm.is_active = true
  limit 1;

  -- The school owner can do everything.
  if v_role = 'owner' then
    return NEW;
  end if;

  foreach v_col in array v_owner_only loop
    if v_old -> v_col is distinct from v_new -> v_col then
      v_owner_only_changed := true;
    end if;
  end loop;
  foreach v_col in array v_other_perms loop
    if v_old -> v_col is distinct from v_new -> v_col then
      v_other_changed := true;
    end if;
  end loop;

  -- Updating your OWN membership row: nothing sensitive may change.
  if OLD.profile_id = v_uid then
    if v_owner_only_changed or v_other_changed
       or OLD.role is distinct from NEW.role
       or OLD.school_id is distinct from NEW.school_id
       or OLD.profile_id is distinct from NEW.profile_id
       or (OLD.is_active is distinct from NEW.is_active and NEW.is_active = true) then
      raise exception 'You cannot change your own role or permissions.' using errcode = '42501';
    end if;
    return NEW;
  end if;

  -- Updating somebody else: only an active teacher admin may, and with limits.
  if v_role is distinct from 'teacher_admin' then
    raise exception 'You do not have permission to change this member.' using errcode = '42501';
  end if;

  if OLD.role = 'owner' then
    raise exception 'The school owner cannot be changed.' using errcode = '42501';
  end if;

  if OLD.school_id is distinct from NEW.school_id or OLD.profile_id is distinct from NEW.profile_id then
    raise exception 'This change is not allowed.' using errcode = '42501';
  end if;

  if OLD.role is distinct from NEW.role then
    if not ((OLD.role = 'teacher' and NEW.role = 'teacher_admin')
         or (OLD.role = 'teacher_admin' and NEW.role = 'teacher')) then
      raise exception 'This role change is not allowed.' using errcode = '42501';
    end if;
  end if;

  if v_owner_only_changed then
    raise exception 'Only the school owner can change this permission.' using errcode = '42501';
  end if;

  if v_other_changed then
    if not v_delegated then
      raise exception 'The school owner has not allowed you to manage permissions.' using errcode = '42501';
    end if;
    if OLD.role is distinct from 'teacher' or NEW.role is distinct from 'teacher' then
      raise exception 'You can only change the permissions of regular teachers.' using errcode = '42501';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_member_permission_rules on school_members;
create trigger trg_enforce_member_permission_rules
  before update on school_members
  for each row execute function enforce_member_permission_rules();
