-- Vacancies can be posted for a school or personally.
-- Existing postings stay as school postings.
alter table vacancies add column if not exists posting_type text not null default 'school';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vacancies_posting_type_check') then
    alter table vacancies add constraint vacancies_posting_type_check check (posting_type in ('school', 'personal'));
  end if;
end $$;
