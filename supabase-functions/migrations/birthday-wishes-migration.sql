-- =========================================================
-- Scholin: birthday wish on the parent dashboard.
-- Run once in the Supabase SQL editor.
--
-- Returns the signed-in parent's children whose birthday is TODAY (Nigerian time),
-- with the school name and the name of the school's owner (shown as the Director).
-- It returns nothing on any other day, so the wish disappears by itself at midnight.
-- A 29 February birthday is celebrated on 28 February in years that have no 29 February.
-- =========================================================
create or replace function get_child_birthday_wishes()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_year int := extract(year from (now() at time zone 'Africa/Lagos'))::int;
  v_leap boolean;
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;
  v_leap := (v_year % 4 = 0 and (v_year % 100 <> 0 or v_year % 400 = 0));

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'student_id', s.id,
      'student_name', s.full_name,
      'school_name', sc.name,
      'director_name', coalesce(nullif(trim(coalesce(dp.title, '') || ' ' || coalesce(dp.full_name, '')), ''), ''),
      'turning', v_year - extract(year from s.dob)::int
    ))
    from parent_student_links l
    join students s on s.id = l.student_id
    join schools sc on sc.id = s.school_id
    left join lateral (
      select p.title, p.full_name
      from school_members m
      join profiles p on p.id = m.profile_id
      where m.school_id = s.school_id and m.role = 'owner' and m.is_active = true
      limit 1
    ) dp on true
    where l.parent_id = v_uid
      and s.dob is not null
      and (
        (extract(month from s.dob) = extract(month from v_today) and extract(day from s.dob) = extract(day from v_today))
        or (not v_leap and extract(month from s.dob) = 2 and extract(day from s.dob) = 29
            and extract(month from v_today) = 2 and extract(day from v_today) = 28)
      )
  ), '[]'::jsonb);
end;
$$;

grant execute on function get_child_birthday_wishes() to authenticated;
