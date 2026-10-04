import { supabase } from './supabase';
import { verifiedUpdate } from './verifiedUpdate';
import { getActiveSchoolContext, switchActiveSchool } from './dashboard';

function fail(error: any, fallback: string): never {
  throw new Error((error && error.message) || fallback);
}

export const ROLE_LABEL: Record<string, string> = { owner: 'School Owner', teacher_admin: 'Teacher Admin', teacher: 'Teacher' };

export async function fetchMyProfile(userId: string) {
  const { data, error } = await supabase.from('profiles').select('full_name, phone, email, avatar_url').eq('id', userId).single();
  if (error || !data) {
    fail(error, 'Could not load your profile.');
  }
  return data as { full_name: string | null; phone: string | null; email: string | null; avatar_url: string | null };
}

export async function saveMyProfile(userId: string, name: string, phone: string, avatarUrl: string | null) {
  await verifiedUpdate('profiles', { full_name: name, phone: phone || null, avatar_url: avatarUrl }, { id: userId }, 'profile');
}

export async function fetchMySchools(userId: string) {
  const ctx = await getActiveSchoolContext(userId);
  if (!ctx) {
    return { activeId: '', list: [] as any[] };
  }
  return { activeId: ctx.membership.school_id as string, list: ctx.allMemberships as any[] };
}

export async function chooseSchool(userId: string, schoolId: string) {
  await switchActiveSchool(userId, schoolId);
}

export async function fetchJoinableSchools(userId: string) {
  const { data: mine } = await supabase.from('school_members').select('school_id').eq('profile_id', userId);
  const joined = (mine || []).map((m: any) => m.school_id as string);
  const { data, error } = await supabase.from('schools').select('id, name, address, logo_url').order('name', { ascending: true });
  if (error) {
    fail(error, 'Could not load schools right now.');
  }
  return ((data || []) as any[]).filter(s => !joined.includes(s.id));
}

export async function requestToJoin(userId: string, schoolId: string) {
  const { error } = await supabase.from('school_members').insert({
    school_id: schoolId,
    profile_id: userId,
    role: 'teacher',
    can_edit_results: false,
    can_generate_report_cards: false,
    can_add_comments: false,
    is_active: false,
  });
  if (error) {
    fail(error, 'Could not send request.');
  }
}

export async function fetchRosterStudents(schoolId: string) {
  const { data: students, error } = await supabase.from('students').select('id, full_name').eq('school_id', schoolId).order('full_name', { ascending: true });
  if (error) {
    fail(error, 'Could not load students.');
  }
  const list = (students || []) as any[];
  if (list.length === 0) {
    return [] as { name: string; sub: string }[];
  }
  const { data: history } = await supabase
    .from('student_class_history')
    .select('student_id, created_at, classes(name, arm)')
    .in('student_id', list.map(s => s.id))
    .order('created_at', { ascending: false });
  const classBy: Record<string, string> = {};
  ((history || []) as any[]).forEach(h => {
    if (!classBy[h.student_id] && h.classes) {
      classBy[h.student_id] = h.classes.arm ? h.classes.name + ' ' + h.classes.arm : h.classes.name;
    }
  });
  return list.map(s => ({ name: s.full_name as string, sub: classBy[s.id] || 'No class assigned' }));
}

export async function fetchRosterStaff(schoolId: string) {
  const { data, error } = await supabase.from('school_members').select('profile_id, role, profiles(full_name)').eq('school_id', schoolId).eq('is_active', true);
  if (error) {
    fail(error, 'Could not load staff.');
  }
  return ((data || []) as any[])
    .map(m => ({ name: ((m.profiles && m.profiles.full_name) || 'Unknown') as string, sub: ROLE_LABEL[m.role] || m.role }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
