-- =========================================================
-- App-wide feature toggles — Vacancy Board and Register
-- Run in Supabase SQL Editor.
-- =========================================================

alter table app_settings add column vacancy_posting_enabled boolean not null default true;
alter table app_settings add column vacancy_page_enabled boolean not null default true;
alter table app_settings add column register_enabled boolean not null default true;

-- vacancy_posting_enabled = false: hides "Post a Vacancy" everywhere, blocks
--   direct access to post-vacancy.html. Existing live vacancies still show.
-- vacancy_page_enabled = false: hides the Job Vacancies / My Postings nav
--   links, the dashboard banner, and blocks direct access to every vacancy
--   page (browsing, posting, detail, pricing). This is the "hide everything"
--   switch and takes priority over vacancy_posting_enabled.
-- register_enabled = false: hides the Register card in every class workspace
--   and blocks direct access to the attendance pages.
