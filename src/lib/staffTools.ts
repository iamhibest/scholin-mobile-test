import { supabase } from './supabase';
import { toISODateLocal } from './format';

function fail(error: any, fallback: string): never {
  throw new Error((error && error.message) || fallback);
}

/* Clock a friend */

export async function fetchClockTargets(schoolId: string, myId: string) {
  const today = toISODateLocal(new Date());
  const [members, records] = await Promise.all([
    supabase.from('school_members').select('id, profile_id, role, profiles(full_name)').eq('school_id', schoolId).eq('is_active', true),
    supabase.from('staff_attendance').select('user_id, clock_in_time, clock_out_time').eq('school_id', schoolId).eq('date', today),
  ]);
  if (members.error) {
    fail(members.error, 'Could not load teachers. Please try again.');
  }
  const by: Record<string, any> = {};
  ((records.data || []) as any[]).forEach(r => {
    by[r.user_id] = r;
  });
  return ((members.data || []) as any[])
    .filter(m => m.profile_id !== myId)
    .map(m => {
      const r = by[m.profile_id] || null;
      const action: 'clock_in' | 'clock_out' | null = r && r.clock_in_time ? (r.clock_out_time ? null : 'clock_out') : 'clock_in';
      return { profileId: m.profile_id as string, name: ((m.profiles && m.profiles.full_name) || 'Unknown') as string, action };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* Teacher results status */

export async function fetchResultsStatus(schoolId: string, userId: string) {
  const { data: mine } = await supabase.from('classes').select('id, name, arm').eq('school_id', schoolId).eq('class_teacher_id', userId);
  const classes = (mine || []) as any[];
  if (classes.length === 0) {
    return { state: 'no_classes' as const, classes: [] as any[] };
  }
  const { data: session } = await supabase.from('sessions').select('id').eq('school_id', schoolId).eq('is_current', true).maybeSingle();
  let termId: string | null = null;
  if (session) {
    const { data: term } = await supabase.from('terms').select('id').eq('session_id', session.id).eq('is_current', true).maybeSingle();
    termId = term ? term.id : null;
  }
  if (!termId) {
    return { state: 'no_term' as const, classes: [] as any[] };
  }
  const ids = classes.map(c => c.id);
  const [roster, subjects, publish, results] = await Promise.all([
    supabase.from('student_class_history').select('student_id, class_id, students(id, full_name)').in('class_id', ids),
    supabase.from('class_subjects').select('class_id, subject_id, subjects(name)').in('class_id', ids),
    supabase.from('subject_publish_status').select('class_id, subject_id, is_published').eq('term_id', termId).in('class_id', ids),
    supabase.from('results').select('student_id, class_id, subject_id').eq('term_id', termId).in('class_id', ids),
  ]);
  const published = new Set(((publish.data || []) as any[]).filter(p => p.is_published).map(p => p.class_id + ':' + p.subject_id));
  const has = new Set(((results.data || []) as any[]).map(r => r.class_id + ':' + r.student_id + ':' + r.subject_id));
  const byId: Record<string, any> = {};
  classes.forEach(c => {
    byId[c.id] = { id: c.id, label: c.arm ? c.name + ' ' + c.arm : c.name, name: c.name, subjects: [] as any[], students: [] as any[] };
  });
  ((subjects.data || []) as any[]).forEach(cs => {
    if (byId[cs.class_id]) {
      byId[cs.class_id].subjects.push({ id: cs.subject_id, name: cs.subjects ? cs.subjects.name : 'Subject', published: published.has(cs.class_id + ':' + cs.subject_id) });
    }
  });
  ((roster.data || []) as any[]).forEach(r => {
    if (r.students && byId[r.class_id]) {
      byId[r.class_id].students.push({ id: r.student_id, name: r.students.full_name });
    }
  });
  Object.values(byId).forEach((c: any) => {
    const sids = c.subjects.map((s: any) => s.id);
    c.students.forEach((st: any) => {
      st.complete = sids.length > 0 && sids.every((sid: string) => published.has(c.id + ':' + sid) && has.has(c.id + ':' + st.id + ':' + sid));
    });
    c.students.sort((a: any, b: any) => a.name.localeCompare(b.name));
  });
  return { state: 'ok' as const, classes: Object.values(byId).sort((a: any, b: any) => a.name.localeCompare(b.name)) };
}

/* Activity log */

export const ACTIVITY_PAGE = 20;

export async function markActivitySeen() {
  try {
    await supabase.rpc('mark_activity_seen');
  } catch {}
}

export async function fetchActivityPage(schoolId: string, offset: number) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('id, activity_type, title, detail, created_at, related_announcement_id, related_payment_id, related_term_id, related_membership_id')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .range(offset, offset + ACTIVITY_PAGE - 1);
  if (error) {
    fail(error, 'Could not load activity right now.');
  }
  return (data || []) as any[];
}

export async function fetchPaymentDetail(id: string) {
  const { data } = await supabase.from('event_payments').select('amount, payment_method, payment_date, receipt_number, notes, events(name, description), students(full_name)').eq('id', id).maybeSingle();
  return data as any;
}

export async function fetchTermDetail(id: string) {
  const { data } = await supabase.from('terms').select('name, term_end_date, next_term_resumes, sessions(name)').eq('id', id).maybeSingle();
  return data as any;
}

export async function fetchMembershipDetail(id: string) {
  const { data } = await supabase.from('school_members').select('role, created_at, profiles(full_name, email, phone)').eq('id', id).maybeSingle();
  return data as any;
}

/* Referrals */

export async function fetchReferralData(userId: string) {
  const { data: profile, error } = await supabase.from('profiles').select('referral_code, bank_name, bank_account_number, bank_account_name').eq('id', userId).single();
  if (error || !profile) {
    fail(error, 'Could not load your referral details.');
  }
  const code = profile.referral_code as string | null;
  const [schools, commissions, payouts] = await Promise.all([
    code ? supabase.from('schools').select('id, name, is_subscribed, subscribed_at').eq('referred_by_code', code) : Promise.resolve({ data: [] as any[] }),
    supabase.from('referral_commissions').select('*, schools(name)').eq('referrer_id', userId).order('created_at', { ascending: false }),
    supabase.from('referral_payouts').select('*').eq('referrer_id', userId).order('paid_at', { ascending: false }),
  ]);
  const pendingBy: Record<string, number> = {};
  let pendingTotal = 0;
  ((commissions.data || []) as any[]).forEach(c => {
    if (c.status === 'pending') {
      pendingBy[c.school_id] = (pendingBy[c.school_id] || 0) + Number(c.commission_amount);
      pendingTotal += Number(c.commission_amount);
    }
  });
  return {
    code,
    bank: { name: profile.bank_name || '', number: profile.bank_account_number || '', holder: profile.bank_account_name || '' },
    schools: ((schools.data || []) as any[]).map(s => ({ ...s, pending: pendingBy[s.id] || 0 })),
    pendingTotal,
    payouts: (payouts.data || []) as any[],
  };
}

export async function saveBank(userId: string, bank: { name: string; number: string; holder: string }) {
  const { error } = await supabase.from('profiles').update({ bank_name: bank.name.trim(), bank_account_number: bank.number.trim(), bank_account_name: bank.holder.trim() }).eq('id', userId);
  if (error) {
    fail(error, 'Could not save bank details.');
  }
}
