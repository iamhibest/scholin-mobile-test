-- =========================================================
-- Scholin — Fix: announcement_reactions was readable by anyone,
-- regardless of which school the underlying announcement belonged to.
--
-- Super-admin broadcasts (announcements.school_id IS NULL) should stay
-- visible to everyone, matching how the announcement itself works.
-- Reactions on a school-specific announcement should only be visible
-- to that school's own active members — mirrors the existing
-- "School members read their school announcements" policy.
--
-- Run in Supabase SQL Editor.
-- =========================================================

drop policy if exists "Everyone reads reactions" on announcement_reactions;

create policy "Reactions visible to the announcement's audience"
on announcement_reactions
for select
using (
  exists (
    select 1 from announcements a
    where a.id = announcement_reactions.announcement_id
    and (
      a.school_id is null
      or a.school_id in (
        select school_members.school_id from school_members
        where school_members.profile_id = auth.uid()
        and school_members.is_active = true
      )
    )
  )
  or exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.is_super_admin = true
  )
);
