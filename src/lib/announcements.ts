import { supabase } from './supabase';

function fail(error: any, fallback: string): never {
  throw new Error((error && error.message) || fallback);
}

export type Reaction = 'like' | 'love' | 'clap';
export const REACTIONS: { key: Reaction; label: string }[] = [
  { key: 'like', label: 'Like' },
  { key: 'love', label: 'Love' },
  { key: 'clap', label: 'Cheer' },
];

export async function fetchAnnouncements(schoolId: string) {
  const { data, error } = await supabase.from('announcements').select('*').or('school_id.is.null,school_id.eq.' + schoolId).order('created_at', { ascending: false }).limit(50);
  if (error) {
    fail(error, 'Could not load announcements.');
  }
  return (data || []) as any[];
}

export async function fetchReactions(ids: string[]) {
  if (ids.length === 0) {
    return [] as any[];
  }
  const { data } = await supabase.from('announcement_reactions').select('*').in('announcement_id', ids);
  return (data || []) as any[];
}

export async function toggleReaction(announcementId: string, profileId: string, reaction: Reaction) {
  const { data: existing } = await supabase.from('announcement_reactions').select('*').eq('announcement_id', announcementId).eq('profile_id', profileId).eq('reaction', reaction).maybeSingle();
  if (existing) {
    await supabase.from('announcement_reactions').delete().eq('id', existing.id);
    return;
  }
  await supabase.from('announcement_reactions').delete().eq('announcement_id', announcementId).eq('profile_id', profileId);
  const { error } = await supabase.from('announcement_reactions').insert({ announcement_id: announcementId, profile_id: profileId, reaction });
  if (error) {
    fail(error, 'Could not save your reaction.');
  }
}

export async function fetchAnnouncement(id: string) {
  const { data, error } = await supabase.from('announcements').select('id, title, body, school_id, created_at').eq('id', id).maybeSingle();
  if (error) {
    fail(error, 'Could not load this announcement.');
  }
  return data as any;
}

export async function fetchSchoolAnnouncements(schoolId: string) {
  const { data, error } = await supabase.from('announcements').select('*').eq('school_id', schoolId).order('created_at', { ascending: false });
  if (error) {
    fail(error, 'Could not load announcements.');
  }
  return (data || []) as any[];
}

export async function postAnnouncement(schoolId: string, userId: string, title: string, body: string) {
  const { data, error } = await supabase.from('announcements').insert({ author_id: userId, school_id: schoolId, title, body }).select().single();
  if (error) {
    fail(error, 'Could not post announcement.');
  }
  // The log entry and the push notification are best effort and run on the server side.
  supabase
    .from('activity_log')
    .insert({
      school_id: schoolId,
      activity_type: 'announcement_posted',
      title: 'New announcement: ' + title,
      detail: body ? (body.length > 140 ? body.slice(0, 140) + '...' : body) : null,
      related_announcement_id: data ? data.id : null,
      created_by: userId,
    })
    .then(() => {});
  supabase.functions.invoke('send-push-notification', { body: { category: 'school_announcement', title: 'New Announcement', message: title, school_id: schoolId } }).catch(() => {});
  return data as any;
}

export async function updateAnnouncement(id: string, title: string, body: string) {
  const { error } = await supabase.from('announcements').update({ title, body }).eq('id', id);
  if (error) {
    fail(error, 'Could not save changes.');
  }
}

export async function deleteAnnouncement(id: string) {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) {
    fail(error, 'Could not delete announcement.');
  }
}

// Unread announcements (like the bell for recent activity): the count goes back to zero once the Announcements page is opened.
export async function fetchUnreadAnnouncements(schoolId: string) {
  try {
    const { data, error } = await supabase.rpc('get_unread_announcements_count', { p_school_id: schoolId });
    return error ? 0 : Number(data || 0);
  } catch {
    return 0;
  }
}

export async function markAnnouncementsSeen() {
  try {
    await supabase.rpc('mark_announcements_seen');
  } catch {}
}
