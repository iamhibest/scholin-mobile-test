-- =====================================================================
-- Scholin: unread announcements badge (run once in the Supabase SQL editor)
-- The megaphone icon on the dashboard shows how many announcements the person
-- has not seen yet. Opening the Announcements page sets the count back to zero
-- until a new announcement is posted. Their own posts are never counted.
-- =====================================================================

alter table profiles add column if not exists last_announcements_seen_at timestamptz;

-- Everyone who already exists starts from now, so nobody gets a huge number on day one.
update profiles set last_announcements_seen_at = now() where last_announcements_seen_at is null;

create or replace function mark_announcements_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set last_announcements_seen_at = now() where id = auth.uid();
$$;

create or replace function get_unread_announcements_count(p_school_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since timestamptz;
  v_count int;
begin
  select coalesce(last_announcements_seen_at, created_at, 'epoch'::timestamptz)
    into v_since
  from profiles where id = auth.uid();

  select count(*) into v_count
  from announcements
  where (school_id is null or school_id = p_school_id)
    and author_id is distinct from auth.uid()
    and created_at > coalesce(v_since, 'epoch'::timestamptz);

  return coalesce(v_count, 0);
end;
$$;

grant execute on function mark_announcements_seen() to authenticated;
grant execute on function get_unread_announcements_count(uuid) to authenticated;
