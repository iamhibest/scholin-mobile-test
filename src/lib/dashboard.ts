import { supabase } from './supabase';
import { toISODateLocal } from './format';

export type Role = 'owner' | 'teacher_admin' | 'teacher';

export type Access = {
  active: boolean;
  reason: 'trial' | 'subscribed' | 'expired' | 'cancelled';
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
};

export type Stat = { value: string; sub: string; warn?: boolean; good?: boolean };

export type StaffData = {
  profile: { full_name: string; avatar_url?: string };
  membership: any;
  allMemberships: any[];
  school: any;
  role: Role;
  isAdmin: boolean;
  access: Access;
  layout: 'adminFees' | 'adminGrid' | 'teacher';
  fees?: { owed: number };
  students?: { count: number; trend: number | null };
  teachers?: { count: number; trend: number | null };
  results?: Stat;
  attendance?: Stat;
  classCount?: number;
  unread: number;
  announcement?: { id: string; title: string; body: string };
  vacancies: { title: string; poster: string }[];
  rotation: number;
};

export function getSchoolAccessStatus(school: any): Access {
  if (!school) {
    return { active: false, reason: 'expired', trialEndsAt: null, subscriptionEndsAt: null };
  }
  // A super admin looking at a school (support work) is never locked out by that school's subscription.
  if (school.__superAdminView) {
    return { active: true, reason: 'subscribed', trialEndsAt: school.trial_ends_at, subscriptionEndsAt: school.subscription_ends_at };
  }
  const base = { trialEndsAt: school.trial_ends_at, subscriptionEndsAt: school.subscription_ends_at };
  if (school.subscription_cancelled_at) {
    return { active: false, reason: 'cancelled', ...base };
  }
  const now = new Date();
  const trialEnds = school.trial_ends_at ? new Date(school.trial_ends_at) : null;
  const subEnds = school.subscription_ends_at ? new Date(school.subscription_ends_at) : null;
  if (subEnds && subEnds > now) {
    return { active: true, reason: 'subscribed', ...base };
  }
  if (trialEnds && trialEnds > now) {
    return { active: true, reason: 'trial', ...base };
  }
  return { active: false, reason: 'expired', ...base };
}

export async function getActiveSchoolContext(userId: string) {
  const [memberships, profile] = await Promise.all([
    supabase.from('school_members').select('*, schools(*)').eq('profile_id', userId).eq('is_active', true),
    supabase.from('profiles').select('active_school_id').eq('id', userId).single(),
  ]);
  const all = memberships.data || [];
  if (all.length === 0) {
    return null;
  }
  let membership: any = null;
  if (profile.data && profile.data.active_school_id) {
    membership = all.find((m: any) => m.school_id === profile.data.active_school_id);
  }
  if (!membership) {
    membership = all[0];
    await supabase.from('profiles').update({ active_school_id: membership.school_id }).eq('id', userId);
  }
  return { membership, allMemberships: all };
}

export async function switchActiveSchool(userId: string, schoolId: string) {
  await supabase.from('profiles').update({ active_school_id: schoolId }).eq('id', userId);
}

export async function getCurrentTermId(schoolId: string) {
  const { data: session } = await supabase.from('sessions').select('id').eq('school_id', schoolId).eq('is_current', true).maybeSingle();
  if (!session) {
    return null;
  }
  const { data: term } = await supabase.from('terms').select('id').eq('session_id', session.id).eq('is_current', true).maybeSingle();
  return term ? term.id : null;
}

function monthTrend(rows: { created_at: string }[]) {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  let added = 0;
  let before = 0;
  rows.forEach(r => {
    const created = new Date(r.created_at);
    if (created >= thisMonth) {
      added++;
    } else if (created >= lastMonth) {
      before++;
    }
  });
  if (before === 0) {
    return null;
  }
  return Math.round(((added - before) / before) * 100);
}

async function attendanceStat(classIds: string[]): Promise<Stat> {
  if (classIds.length === 0) {
    return { value: '-', sub: 'No classes assigned yet' };
  }
  const day = new Date().getDay();
  if (day === 0 || day === 6) {
    return { value: '-', sub: 'No register due today (weekend)' };
  }
  const today = toISODateLocal(new Date());
  const [roster, marks] = await Promise.all([
    supabase.from('student_class_history').select('student_id, class_id').in('class_id', classIds),
    supabase.from('daily_attendance_marks').select('student_id, class_id').eq('mark_date', today).in('class_id', classIds),
  ]);
  const byClass: Record<string, Set<string>> = {};
  (roster.data || []).forEach((r: any) => {
    (byClass[r.class_id] = byClass[r.class_id] || new Set()).add(r.student_id);
  });
  const marked: Record<string, Set<string>> = {};
  (marks.data || []).forEach((m: any) => {
    (marked[m.class_id] = marked[m.class_id] || new Set()).add(m.student_id);
  });
  let withStudents = 0;
  let gaps = 0;
  classIds.forEach(id => {
    const set = byClass[id] || new Set<string>();
    if (set.size === 0) {
      return;
    }
    withStudents++;
    const done = marked[id] || new Set<string>();
    if (!Array.from(set).every(s => done.has(s))) {
      gaps++;
    }
  });
  if (withStudents === 0) {
    return { value: '-', sub: 'No students in your classes yet' };
  }
  if (gaps > 0) {
    return { value: String(gaps), sub: gaps + ' of ' + withStudents + ' class' + (withStudents === 1 ? '' : 'es') + ' not fully marked today', warn: true };
  }
  return { value: 'Done', sub: 'All registers fully marked for today', good: true };
}

async function resultsStat(schoolId: string, classIds: string[]): Promise<Stat> {
  if (classIds.length === 0) {
    return { value: '-', sub: 'No classes assigned yet' };
  }
  const termId = await getCurrentTermId(schoolId);
  if (!termId) {
    return { value: '-', sub: 'No current term set up yet' };
  }
  const [roster, subjects, publish, results] = await Promise.all([
    supabase.from('student_class_history').select('student_id, class_id').in('class_id', classIds),
    supabase.from('class_subjects').select('class_id, subject_id').in('class_id', classIds),
    supabase.from('subject_publish_status').select('class_id, subject_id, is_published').eq('term_id', termId).in('class_id', classIds),
    supabase.from('results').select('student_id, class_id, subject_id').eq('term_id', termId).in('class_id', classIds),
  ]);
  const rosterBy: Record<string, string[]> = {};
  (roster.data || []).forEach((r: any) => {
    (rosterBy[r.class_id] = rosterBy[r.class_id] || []).push(r.student_id);
  });
  const published = new Set((publish.data || []).filter((p: any) => p.is_published).map((p: any) => p.class_id + ':' + p.subject_id));
  const subjectsBy: Record<string, string[]> = {};
  (subjects.data || []).forEach((cs: any) => {
    (subjectsBy[cs.class_id] = subjectsBy[cs.class_id] || []).push(cs.subject_id);
  });
  const hasResult = new Set((results.data || []).map((r: any) => r.class_id + ':' + r.student_id + ':' + r.subject_id));
  let total = 0;
  let done = 0;
  classIds.forEach(classId => {
    const students = rosterBy[classId] || [];
    const subs = subjectsBy[classId] || [];
    total += students.length;
    if (subs.length === 0) {
      return;
    }
    students.forEach(studentId => {
      if (subs.every(sid => published.has(classId + ':' + sid) && hasResult.has(classId + ':' + studentId + ':' + sid))) {
        done++;
      }
    });
  });
  if (total === 0) {
    return { value: '-', sub: 'No students in your classes yet' };
  }
  const complete = done === total;
  return {
    value: complete ? done + ' published' : done + ' of ' + total,
    sub: complete ? 'All your results are published' : 'results published so far',
    good: complete,
    warn: !complete,
  };
}

async function feesOwed(schoolId: string) {
  const { data: events } = await supabase.from('events').select('id').eq('school_id', schoolId).is('deleted_at', null);
  const ids = (events || []).map((e: any) => e.id);
  if (ids.length === 0) {
    return 0;
  }
  const [assigned, payments] = await Promise.all([
    supabase.from('event_students').select('amount_due, event_id').in('event_id', ids),
    supabase.from('event_payments').select('amount, event_id, status').in('event_id', ids).eq('status', 'valid'),
  ]);
  const paid: Record<string, number> = {};
  (payments.data || []).forEach((p: any) => {
    paid[p.event_id] = (paid[p.event_id] || 0) + Number(p.amount);
  });
  let owed = 0;
  (assigned.data || []).forEach((es: any) => {
    const due = Number(es.amount_due);
    const available = Math.min(paid[es.event_id] || 0, due);
    owed += Math.max(0, due - available);
  });
  return owed;
}

export async function loadStaffDashboard(userId: string): Promise<StaffData | 'superadmin' | 'onboarding'> {
  const { data: profile } = await supabase.from('profiles').select('is_super_admin, full_name, avatar_url').eq('id', userId).single();
  if (profile && profile.is_super_admin) {
    return 'superadmin';
  }
  const context = await getActiveSchoolContext(userId);
  if (!context) {
    return 'onboarding';
  }
  const { membership, allMemberships } = context;
  const school = membership.schools;
  const role = membership.role as Role;
  const isAdmin = role === 'owner' || role === 'teacher_admin';
  const canFees = role === 'owner' || membership.can_manage_events_fees !== false;

  const data: StaffData = {
    profile: { full_name: profile?.full_name || 'there', avatar_url: profile?.avatar_url },
    membership,
    allMemberships,
    school,
    role,
    isAdmin,
    access: getSchoolAccessStatus(school),
    layout: isAdmin ? (canFees ? 'adminFees' : 'adminGrid') : 'teacher',
    unread: 0,
    vacancies: [],
    rotation: 8,
  };

  if (isAdmin) {
    const [students, teachers] = await Promise.all([
      supabase.from('students').select('id, created_at').eq('school_id', school.id),
      supabase.from('school_members').select('id, created_at').eq('school_id', school.id).eq('is_active', true),
    ]);
    data.students = { count: (students.data || []).length, trend: monthTrend(students.data || []) };
    data.teachers = { count: (teachers.data || []).length, trend: monthTrend(teachers.data || []) };
    if (canFees) {
      data.fees = { owed: await feesOwed(school.id) };
    }
  }
  if (!isAdmin || !canFees) {
    const { data: mine } = await supabase.from('classes').select('id').eq('school_id', school.id).eq('class_teacher_id', userId);
    const ids = (mine || []).map((c: any) => c.id);
    data.classCount = ids.length;
    const [att, res] = await Promise.all([attendanceStat(ids), resultsStat(school.id, ids)]);
    data.attendance = att;
    data.results = res;
  }

  const [ann, vac, pricing, unread] = await Promise.all([
    supabase.from('announcements').select('id, title, body, created_at').is('school_id', null).order('created_at', { ascending: false }).limit(1),
    supabase
      .from('vacancies')
      .select('title, profiles!posted_by(full_name)')
      .eq('is_active', true)
      .in('payment_status', ['paid', 'free'])
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('vacancy_pricing').select('rotation_seconds').limit(1).maybeSingle(),
    supabase.rpc('get_unread_activity_count', { p_school_id: school.id }),
  ]);
  if (ann.data && ann.data.length > 0) {
    data.announcement = ann.data[0];
  }
  data.vacancies = ((vac.data as any[]) || []).map(v => ({ title: v.title, poster: v.profiles?.full_name || '' }));
  data.rotation = pricing.data?.rotation_seconds || 8;
  data.unread = typeof unread.data === 'number' ? unread.data : 0;
  return data;
}
