-- =========================================================
-- Scholin — School-scoped announcement management (update/delete)
-- Run in Supabase SQL Editor.
--
-- announcements previously had only SELECT and INSERT policies for
-- owner/teacher_admin — there was no UPDATE or DELETE policy for
-- school-scoped announcements at all, meaning the existing "Delete"
-- button on admin-announcements.html was very likely already
-- failing silently under RLS before this. This adds both, scoped
-- the same way the insert policy already is: only announcements
-- belonging to a school the user is an active owner/teacher_admin
-- member of, and only ever their own school's rows (never
-- platform-wide school_id is null broadcasts, which remain
-- super-admin-only).
-- =========================================================

create policy "Admins update their school announcements"
on announcements for update
using (
  school_id in (
    select school_id from school_members
    where profile_id = auth.uid() and is_active = true and role in ('owner','teacher_admin')
  )
)
with check (
  school_id in (
    select school_id from school_members
    where profile_id = auth.uid() and is_active = true and role in ('owner','teacher_admin')
  )
);

create policy "Admins delete their school announcements"
on announcements for delete
using (
  school_id in (
    select school_id from school_members
    where profile_id = auth.uid() and is_active = true and role in ('owner','teacher_admin')
  )
);
