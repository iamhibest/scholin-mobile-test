-- Vacancies: school or personal posting, plus location, category and job type.
alter table vacancies add column if not exists posting_type text not null default 'school';
alter table vacancies add column if not exists location text;
alter table vacancies add column if not exists category text not null default 'teaching';
alter table vacancies add column if not exists job_type text not null default 'full_time';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vacancies_posting_type_check') then
    alter table vacancies add constraint vacancies_posting_type_check check (posting_type in ('school', 'personal'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vacancies_category_check') then
    alter table vacancies add constraint vacancies_category_check check (category in ('teaching', 'administration', 'support'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vacancies_job_type_check') then
    alter table vacancies add constraint vacancies_job_type_check check (job_type in ('full_time', 'part_time', 'contract'));
  end if;
end $$;
