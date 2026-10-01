import { supabase } from './supabase';

export type Child = { id: string; full_name: string; photo_url?: string; school_id: string; school_name: string };
export type Session = { id: string; name: string; is_current: boolean };

export type FeeRow = { id: string; eventId: string; name: string; type: string; dueDate?: string; due: number; paid: number; owed: number; description?: string };
export type EventRow = { id: string; name: string; type: string; dueDate: string };
export type ReportRow = {
  termId: string;
  termName: string;
  classId: string;
  sessionId: string;
  state: 'available' | 'locked' | 'pending';
  publishedAt?: string;
  outstanding: { name: string; balance: number }[];
};
export type NewsRow = { id: string; title: string; body: string; created_at: string; broadcast: boolean };

export type ChildOverview = {
  owed: number;
  events: EventRow[];
  fees: FeeRow[];
  reports: ReportRow[];
  availableReports: number;
  news: NewsRow[];
};

export async function loadParentProfile(userId: string) {
  const { data } = await supabase.from('profiles').select('full_name, title, email, phone').eq('id', userId).single();
  const name = data ? (data.title ? data.title + ' ' + data.full_name : data.full_name) : 'there';
  return { name, email: data?.email || '', phone: data?.phone || '' };
}

export async function loadChildren(userId: string): Promise<Child[]> {
  const { data, error } = await supabase
    .from('parent_student_links')
    .select('student_id, students(id, full_name, photo_url, school_id, schools(name))')
    .eq('parent_id', userId);
  if (error) {
    throw error;
  }
  return (data || [])
    .filter((l: any) => l.students)
    .map((l: any) => ({
      id: l.students.id,
      full_name: l.students.full_name,
      photo_url: l.students.photo_url,
      school_id: l.students.school_id,
      school_name: l.students.schools ? l.students.schools.name : 'School',
    }));
}

export async function loadSessions(schoolId: string): Promise<Session[]> {
  const { data } = await supabase.from('sessions').select('id, name, is_current, created_at').eq('school_id', schoolId).order('created_at', { ascending: false });
  return (data || []) as Session[];
}

export async function linkChildByCode(userId: string, code: string, existing: Child[]) {
  const { data: row, error } = await supabase.from('student_invite_codes').select('id, student_id, uses_remaining').eq('code', code).eq('is_active', true).maybeSingle();
  if (error || !row) {
    return 'That invite code was not recognized. Please check it and try again.';
  }
  if (row.uses_remaining <= 0) {
    return 'This invite code has reached its limit of linked accounts. Please contact the school for a new code.';
  }
  if (existing.some(c => c.id === row.student_id)) {
    return 'This child is already linked to your account.';
  }
  const { error: linkError } = await supabase.from('parent_student_links').insert({ parent_id: userId, student_id: row.student_id, linked_via: 'invite_code' });
  if (linkError) {
    return 'Could not link this child. Please try again.';
  }
  await supabase.from('student_invite_codes').update({ uses_remaining: row.uses_remaining - 1 }).eq('id', row.id);
  return '';
}

export async function loadChildOverview(child: Child, sessionId: string | null): Promise<ChildOverview> {
  const studentId = child.id;
  const termsResult = sessionId
    ? await supabase.from('terms').select('id, name, days_school_opened, session_id, is_current').eq('session_id', sessionId).order('created_at', { ascending: true })
    : { data: [] as any[] };
  const terms: any[] = termsResult.data || [];

  const [assigned, payments, school, broadcast] = await Promise.all([
    supabase
      .from('event_students')
      .select('id, amount_due, event_id, events(id, name, description, due_date, status, event_type, deleted_at)')
      .eq('student_id', studentId),
    supabase.from('event_payments').select('event_id, amount, status').eq('student_id', studentId).eq('status', 'valid'),
    child.school_id
      ? supabase.from('announcements').select('id, title, body, created_at').eq('school_id', child.school_id).order('created_at', { ascending: false }).limit(5)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('announcements').select('id, title, body, created_at').is('school_id', null).order('created_at', { ascending: false }).limit(3),
  ]);

  const paid: Record<string, number> = {};
  (payments.data || []).forEach((p: any) => {
    paid[p.event_id] = (paid[p.event_id] || 0) + Number(p.amount);
  });
  const active = (assigned.data || []).filter((es: any) => es.events && !es.events.deleted_at);
  const fees: FeeRow[] = active.map((es: any) => {
    const due = Number(es.amount_due);
    const p = Math.min(paid[es.event_id] || 0, due);
    return {
      id: es.id,
      eventId: es.event_id,
      name: es.events.name,
      type: es.events.event_type,
      dueDate: es.events.due_date,
      due,
      paid: p,
      owed: Math.max(0, due - p),
      description: es.events.description,
    };
  });
  const owed = fees.reduce((sum, f) => sum + f.owed, 0);

  const now = new Date();
  const seen = new Set<string>();
  const events: EventRow[] = [];
  active.forEach((es: any) => {
    const ev = es.events;
    if (ev && ev.due_date && new Date(ev.due_date) >= now && !seen.has(ev.id)) {
      seen.add(ev.id);
      events.push({ id: ev.id, name: ev.name, type: ev.event_type, dueDate: ev.due_date });
    }
  });
  events.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const news: NewsRow[] = [
    ...(broadcast.data || []).map((n: any) => ({ ...n, broadcast: true })),
    ...(school.data || []).map((n: any) => ({ ...n, broadcast: false })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const reports = await loadReports(studentId, terms);
  return { owed, events, fees, reports, availableReports: reports.filter(r => r.state === 'available').length, news };
}

async function loadReports(studentId: string, terms: any[]): Promise<ReportRow[]> {
  if (terms.length === 0) {
    return [];
  }
  const { data: history } = await supabase
    .from('student_class_history')
    .select('class_id, session_id')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!history) {
    return [];
  }
  const checks = await Promise.all(
    terms.map(async term => {
      const [release, results] = await Promise.all([
        supabase.from('class_term_report_publish').select('is_published_to_parents, published_at').eq('class_id', history.class_id).eq('term_id', term.id).maybeSingle(),
        supabase.from('results').select('id').eq('student_id', studentId).eq('term_id', term.id).limit(1),
      ]);
      const ready = !!(release.data && release.data.is_published_to_parents) && !!(results.data && results.data.length > 0);
      let unlocked = true;
      let outstanding: { name: string; balance: number }[] = [];
      if (ready) {
        const { data: status } = await supabase.rpc('get_report_release_status', { p_student_id: studentId, p_term_id: term.id });
        if (status) {
          unlocked = !!status.unlocked;
          outstanding = (status.outstanding || []).map((o: any) => ({ name: o.name, balance: Number(o.balance) }));
        }
      }
      const state: ReportRow['state'] = ready ? (unlocked ? 'available' : 'locked') : 'pending';
      return {
        termId: term.id,
        termName: term.name,
        classId: history.class_id,
        sessionId: history.session_id,
        state,
        publishedAt: release.data?.published_at,
        outstanding,
      } as ReportRow;
    }),
  );
  return checks;
}
