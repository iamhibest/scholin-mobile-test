-- Vacancies: delete a post automatically 7 days after it expired.
-- Run this once in the Supabase SQL editor.
-- If pg_cron is not enabled yet: Supabase dashboard > Database > Extensions > search "pg_cron" > enable.

create extension if not exists pg_cron;

create or replace function delete_expired_vacancies()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  removed integer := 0;
begin
  for r in
    select id from vacancies where expires_at < now() - interval '7 days'
  loop
    begin
      delete from vacancies where id = r.id;
      removed := removed + 1;
    exception when foreign_key_violation then
      -- Something (for example a payment record) still points at this post. Keep it rather than fail the whole run.
      null;
    end;
  end loop;
  return removed;
end;
$$;

-- Every day at 02:00 (database time, UTC).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'delete-expired-vacancies') then
    perform cron.unschedule('delete-expired-vacancies');
  end if;
  perform cron.schedule('delete-expired-vacancies', '0 2 * * *', 'select delete_expired_vacancies();');
end $$;

-- Optional: run it once now to clear anything already older than 7 days past expiry.
-- select delete_expired_vacancies();
