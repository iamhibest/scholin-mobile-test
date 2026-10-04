import { supabase } from './supabase';
import { verifiedUpdate } from './verifiedUpdate';
import { addDays, weekStartOf } from './attendance';
import { toISODateLocal } from './format';

function fail(error: any, fallback: string): never {
  throw new Error((error && error.message) || fallback);
}

export async function fetchSubjects(schoolId: string) {
  const { data, error } = await supabase.from('subjects').select('*').eq('school_id', schoolId).order('name', { ascending: true });
  if (error) {
    fail(error, 'Could not load subjects.');
  }
  return data || [];
}

export async function addSubject(schoolId: string, name: string) {
  const { error } = await supabase.from('subjects').insert({ school_id: schoolId, name });
  if (error) {
    fail(error, 'Could not add subject.');
  }
}

export async function renameSubject(id: string, name: string) {
  const { error } = await supabase.from('subjects').update({ name }).eq('id', id);
  if (error) {
    fail(error, 'Could not rename subject.');
  }
}

export async function deleteSubject(id: string) {
  const { error } = await supabase.from('subjects').delete().eq('id', id);
  if (error) {
    fail(error, 'Could not remove subject.');
  }
}

export async function fetchBands(schoolId: string) {
  const { data, error } = await supabase.from('auto_comment_bands').select('*').eq('school_id', schoolId).order('min_score', { ascending: true });
  if (error) {
    fail(error, 'Could not load bands.');
  }
  return data || [];
}

export async function addBand(schoolId: string, b: { min: number; max: number; teacher: string; head: string; principal: string }) {
  const { error } = await supabase.from('auto_comment_bands').insert({
    school_id: schoolId,
    min_score: b.min,
    max_score: b.max,
    class_teacher_text: b.teacher.trim(),
    head_teacher_text: b.head.trim(),
    principal_text: b.principal.trim(),
  });
  if (error) {
    fail(error, 'Could not add band.');
  }
}

export async function deleteBand(id: string) {
  const { error } = await supabase.from('auto_comment_bands').delete().eq('id', id);
  if (error) {
    fail(error, 'Could not remove band.');
  }
}

export async function fetchSessionsWithTerms(schoolId: string, archived: boolean) {
  const { data, error } = await supabase.from('sessions').select('*, terms(*)').eq('school_id', schoolId).eq('is_archived', archived).order('created_at', { ascending: false });
  if (error) {
    fail(error, 'Could not load sessions.');
  }
  return (data || []).map((s: any) => ({ ...s, terms: (s.terms || []).slice().sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at))) }));
}

export async function addSession(schoolId: string, name: string) {
  const { error } = await supabase.from('sessions').insert({ school_id: schoolId, name, is_current: false });
  if (error) {
    fail(error, 'Could not add session.');
  }
}

export async function renameSession(id: string, name: string) {
  const { error } = await supabase.from('sessions').update({ name }).eq('id', id);
  if (error) {
    fail(error, 'Could not save changes.');
  }
}

export async function makeSessionCurrent(schoolId: string, sessionId: string, promote: boolean) {
  await supabase.from('sessions').update({ is_current: false }).eq('school_id', schoolId);
  const { error } = await supabase.from('sessions').update({ is_current: true }).eq('id', sessionId);
  if (error) {
    fail(error, 'Could not change the current session.');
  }
  if (promote) {
    return runAutoPromotion(schoolId, sessionId);
  }
  return null;
}

export async function setArchived(sessionId: string, archived: boolean) {
  const patch: any = archived ? { is_archived: true, is_current: false } : { is_archived: false };
  const { error } = await supabase.from('sessions').update(patch).eq('id', sessionId);
  if (error) {
    fail(error, 'Could not update this session.');
  }
}

export async function deleteSession(id: string) {
  const { error } = await supabase.from('sessions').delete().eq('id', id);
  if (error) {
    fail(error, 'Could not delete session.');
  }
}

export async function makeTermCurrent(termId: string, sessionId: string) {
  const { data: siblings } = await supabase.from('terms').select('id').eq('session_id', sessionId);
  for (const t of siblings || []) {
    await supabase.from('terms').update({ is_current: false }).eq('id', t.id);
  }
  const { error } = await supabase.from('terms').update({ is_current: true }).eq('id', termId);
  if (error) {
    fail(error, 'Could not change the current term.');
  }
}

export type TermForm = { name: string; end: string; resume: string; days: string };

export async function saveTerm(sessionId: string, termId: string | null, f: TermForm) {
  const payload = { name: f.name.trim(), term_end_date: f.end || null, next_term_resumes: f.resume || null, days_school_opened: parseInt(f.days, 10) || 0 };
  const res = termId ? await supabase.from('terms').update(payload).eq('id', termId) : await supabase.from('terms').insert({ session_id: sessionId, is_current: false, ...payload });
  if (res.error) {
    fail(res.error, 'Could not save the term.');
  }
}

export async function addComponent(schoolId: string, termId: string, name: string, max: number) {
  const { data: existing } = await supabase.from('assessment_components').select('id').eq('term_id', termId);
  const { error } = await supabase.from('assessment_components').insert({ school_id: schoolId, term_id: termId, name, max_score: max, order_index: existing ? existing.length : 0 });
  if (error) {
    fail(error, 'Could not add component.');
  }
}

export async function deleteComponent(id: string) {
  const { error } = await supabase.from('assessment_components').delete().eq('id', id);
  if (error) {
    fail(error, 'Could not remove component.');
  }
}

export async function runAutoPromotion(schoolId: string, newSessionId: string) {
  const { data: sessions } = await supabase.from('sessions').select('*').eq('school_id', schoolId).order('created_at', { ascending: false });
  const prev = (sessions || []).find((s: any) => s.id !== newSessionId);
  if (!prev) {
    return { promoted: 0, skipped: 0, total: 0 };
  }
  const { data: terms } = await supabase.from('terms').select('*').eq('session_id', prev.id).order('created_at', { ascending: false }).limit(1);
  const lastTerm = terms && terms[0];
  if (!lastTerm) {
    return { promoted: 0, skipped: 0, total: 0 };
  }
  const { data: prevHistory } = await supabase.from('student_class_history').select('student_id').eq('session_id', prev.id);
  const studentIds = Array.from(new Set((prevHistory || []).map((h: any) => h.student_id as string)));
  if (studentIds.length === 0) {
    return { promoted: 0, skipped: 0, total: 0 };
  }
  const { data: remarks } = await supabase.from('report_card_remarks').select('student_id, promoted_to').eq('term_id', lastTerm.id).in('student_id', studentIds);
  const promotedTo: Record<string, string> = {};
  (remarks || []).forEach((r: any) => {
    if (r.promoted_to) {
      promotedTo[r.student_id] = r.promoted_to;
    }
  });
  const { data: newClasses } = await supabase.from('classes').select('*').eq('session_id', newSessionId);
  const byLabel: Record<string, string> = {};
  (newClasses || []).forEach((c: any) => {
    byLabel[c.name + (c.arm ? ' ' + c.arm : '')] = c.id;
  });
  const { data: existing } = await supabase.from('student_class_history').select('student_id').eq('session_id', newSessionId);
  const assigned = new Set((existing || []).map((h: any) => h.student_id));
  let promoted = 0;
  let skipped = 0;
  const rows: any[] = [];
  studentIds.forEach(id => {
    if (assigned.has(id)) {
      return;
    }
    const classId = promotedTo[id] ? byLabel[promotedTo[id]] : null;
    if (classId) {
      rows.push({ student_id: id, class_id: classId, session_id: newSessionId });
      promoted++;
    } else {
      skipped++;
    }
  });
  if (rows.length) {
    await supabase.from('student_class_history').insert(rows);
  }
  return { promoted, skipped, total: studentIds.length };
}

export async function fetchUnassigned(schoolId: string, currentSessionId: string) {
  const { data: sessions } = await supabase.from('sessions').select('*').eq('school_id', schoolId).order('created_at', { ascending: false });
  const prev = (sessions || []).find((s: any) => s.id !== currentSessionId);
  let candidates: string[] = [];
  if (prev) {
    const { data: h } = await supabase.from('student_class_history').select('student_id').eq('session_id', prev.id);
    candidates = Array.from(new Set((h || []).map((x: any) => x.student_id as string)));
  } else {
    const { data: all } = await supabase.from('students').select('id').eq('school_id', schoolId);
    candidates = (all || []).map((s: any) => s.id as string);
  }
  if (candidates.length === 0) {
    return [];
  }
  const { data: current } = await supabase.from('student_class_history').select('student_id').eq('session_id', currentSessionId);
  const assigned = new Set((current || []).map((x: any) => x.student_id));
  const ids = candidates.filter(id => !assigned.has(id));
  if (ids.length === 0) {
    return [];
  }
  const { data: students } = await supabase.from('students').select('*').in('id', ids).order('full_name');
  return students || [];
}

export async function placeStudent(studentId: string, classId: string, sessionId: string) {
  const { error } = await supabase.from('student_class_history').insert({ student_id: studentId, class_id: classId, session_id: sessionId });
  if (error) {
    fail(error, 'Could not assign this student.');
  }
}

export async function moveStudent(studentId: string, classId: string, sessionId: string) {
  await supabase.from('student_class_history').delete().eq('student_id', studentId).eq('session_id', sessionId);
  const { error } = await supabase.from('student_class_history').insert({ student_id: studentId, class_id: classId, session_id: sessionId });
  if (error) {
    fail(error, 'Could not move this student.');
  }
}

export async function fetchCurrentSession(schoolId: string) {
  const { data } = await supabase.from('sessions').select('*').eq('school_id', schoolId).eq('is_current', true).maybeSingle();
  return data;
}

export async function fetchClassCounts(sessionId: string) {
  const [classes, roster] = await Promise.all([
    supabase.from('classes').select('id, name, arm').eq('session_id', sessionId).order('name', { ascending: true }),
    supabase.from('student_class_history').select('class_id').eq('session_id', sessionId),
  ]);
  const counts: Record<string, number> = {};
  (roster.data || []).forEach((r: any) => {
    counts[r.class_id] = (counts[r.class_id] || 0) + 1;
  });
  return (classes.data || []).map((c: any) => ({ id: c.id as string, name: c.name as string, arm: (c.arm || '') as string, count: counts[c.id] || 0 }));
}

export async function fetchStaffMembers(schoolId: string) {
  const { data } = await supabase.from('school_members').select('profile_id, role, profiles(id, full_name)').eq('school_id', schoolId).eq('is_active', true);
  return (data || [])
    .map((m: any) => m.profiles)
    .filter(Boolean)
    .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name)) as { id: string; full_name: string }[];
}

export async function fetchStaffDay(schoolId: string, date: string) {
  const { data } = await supabase
    .from('staff_attendance')
    .select('*, clock_in_proxy:clock_in_proxy_user_id(full_name), clock_out_proxy:clock_out_proxy_user_id(full_name)')
    .eq('school_id', schoolId)
    .eq('date', date);
  return data || [];
}

export async function fetchStaffRecord(id: string) {
  const { data, error } = await supabase
    .from('staff_attendance')
    .select('*, profiles(full_name), schools(name), clock_in_proxy:clock_in_proxy_user_id(full_name), clock_out_proxy:clock_out_proxy_user_id(full_name)')
    .eq('id', id)
    .single();
  if (error) {
    fail(error, 'Record not found.');
  }
  return data;
}

export async function fetchStaffRange(schoolId: string, start: string, end: string) {
  const { data } = await supabase.from('staff_attendance').select('user_id, date, clock_in_status, clock_in_time, clock_out_time').eq('school_id', schoolId).gte('date', start).lte('date', end);
  const by: Record<string, any[]> = {};
  (data || []).forEach((r: any) => {
    by[r.user_id] = by[r.user_id] || [];
    by[r.user_id].push(r);
  });
  Object.keys(by).forEach(k => by[k].sort((a, b) => a.date.localeCompare(b.date)));
  return by;
}

export type PeriodType = 'day' | 'week' | 'month' | 'term' | 'session';

export function monthOptions() {
  const out: { value: string; label: string }[] = [];
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ value: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), label: names[d.getMonth()] + ' ' + d.getFullYear() });
  }
  return out;
}

export function monthRange(value: string) {
  const [y, m] = value.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: value + '-01', end: value + '-' + String(last).padStart(2, '0') };
}

export function weekRange(anyDay: string) {
  const start = weekStartOf(anyDay);
  return { start, end: addDays(start, 6) };
}

export function staffTermRange(terms: any[], termId: string) {
  const idx = terms.findIndex(t => t.id === termId);
  if (idx === -1) {
    return null;
  }
  const term = terms[idx];
  const prev = idx > 0 ? terms[idx - 1] : null;
  const start = prev && prev.term_end_date ? addDays(prev.term_end_date, 1) : toISODateLocal(new Date(term.created_at));
  return { start, end: term.term_end_date || toISODateLocal(new Date()) };
}

export function staffSessionRange(terms: any[]) {
  if (terms.length === 0) {
    return null;
  }
  const last = terms[terms.length - 1];
  return { start: toISODateLocal(new Date(terms[0].created_at)), end: last.term_end_date || toISODateLocal(new Date()) };
}

export async function fetchStudentMarks(classId: string, range: { start?: string; end?: string; termIds?: string[] }) {
  let q = supabase.from('daily_attendance_marks').select('student_id, mark_date, status').eq('class_id', classId);
  q = range.termIds ? q.in('term_id', range.termIds) : q.gte('mark_date', range.start as string).lte('mark_date', range.end as string);
  const { data } = await q;
  const by: Record<string, any[]> = {};
  (data || []).forEach((m: any) => {
    by[m.student_id] = by[m.student_id] || [];
    by[m.student_id].push(m);
  });
  Object.keys(by).forEach(k => by[k].sort((a, b) => a.mark_date.localeCompare(b.mark_date)));
  return by;
}

export async function fetchPoints(schoolId: string) {
  const { data, error } = await supabase.from('attendance_points').select('*').eq('school_id', schoolId).order('created_at');
  if (error) {
    fail(error, 'Could not load attendance points.');
  }
  return data || [];
}

export async function createPoint(schoolId: string, name: string, lat: number, lng: number, radius: number | null) {
  const { error } = await supabase.from('attendance_points').insert({ school_id: schoolId, name, latitude: lat, longitude: lng, radius_meters: radius });
  if (error) {
    fail(error, 'Could not create attendance point.');
  }
}

export async function setPointActive(id: string, active: boolean) {
  const { error } = await supabase.from('attendance_points').update({ is_active: active }).eq('id', id);
  if (error) {
    fail(error, 'Could not update this attendance point.');
  }
}

export async function deletePoint(id: string) {
  const { error } = await supabase.from('attendance_points').delete().eq('id', id);
  if (error) {
    fail(error, 'Could not delete this attendance point.');
  }
}

export async function fetchSchoolRow(schoolId: string) {
  const { data, error } = await supabase.from('schools').select('*').eq('id', schoolId).single();
  if (error) {
    fail(error, 'Could not load school settings.');
  }
  return data;
}

export async function updateSchool(schoolId: string, patch: Record<string, any>) {
  await verifiedUpdate('schools', patch, { id: schoolId }, 'school settings');
}

export async function fetchGrades(schoolId: string) {
  const { data } = await supabase.from('grading_scale').select('*').eq('school_id', schoolId).order('min_score', { ascending: false });
  return data || [];
}

export async function addGrade(schoolId: string, min: number, max: number, grade: string, remark: string) {
  const { error } = await supabase.from('grading_scale').insert({ school_id: schoolId, min_score: min, max_score: max, grade, remark });
  if (error) {
    fail(error, 'Could not add grade band.');
  }
}

export async function deleteGrade(id: string) {
  const { error } = await supabase.from('grading_scale').delete().eq('id', id);
  if (error) {
    fail(error, 'Could not remove grade band.');
  }
}

export async function saveTemplate(schoolId: string, userId: string, payload: any) {
  const { error } = await supabase.from('report_card_templates').upsert({ school_id: schoolId, updated_by: userId, updated_at: new Date().toISOString(), ...payload }, { onConflict: 'school_id' });
  if (error) {
    fail(error, 'Could not save your template.');
  }
}

export async function fetchPaymentTerms(userId: string) {
  const { data: settings } = await supabase.from('app_settings').select('payment_terms_and_conditions, payment_terms_version').limit(1).maybeSingle();
  const text = settings ? (settings.payment_terms_and_conditions as string | null) : null;
  const version = settings ? settings.payment_terms_version : null;
  if (!text) {
    return { text: null as string | null, version, accepted: true };
  }
  const { data: me } = await supabase.from('profiles').select('payment_terms_accepted_version').eq('id', userId).single();
  return { text, version, accepted: !!me && me.payment_terms_accepted_version === version };
}

export async function acceptPaymentTerms(userId: string, version: any) {
  await supabase.from('profiles').update({ payment_terms_accepted_version: version, payment_terms_accepted_at: new Date().toISOString() }).eq('id', userId);
}
