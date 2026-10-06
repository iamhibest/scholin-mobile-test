-- =====================================================================
-- Scholin: user management for the super admin (run once in the SQL editor)
-- 1. Adds the blocked flag fields to profiles.
-- 2. Lets deleting a user keep old records: every optional reference to a
--    profile (created_by, recorded_by, marked_by and similar) becomes
--    "set to empty" when that user is deleted, instead of blocking the delete.
--    schools.owner_id is left alone on purpose, and required columns
--    (such as who started a payment) still protect financial history.
-- =====================================================================

alter table profiles add column if not exists is_blocked boolean not null default false;
alter table profiles add column if not exists blocked_at timestamptz;
alter table profiles add column if not exists blocked_reason text;

do $$
declare
  r record;
begin
  for r in
    select c.conname, c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.profiles'::regclass
      and c.confdeltype in ('a', 'r')
      and array_length(c.conkey, 1) = 1
      and not a.attnotnull
      and not (c.conrelid = 'public.schools'::regclass and a.attname = 'owner_id')
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references public.profiles(id) on delete set null', r.tbl, r.conname, r.col);
  end loop;
end $$;
