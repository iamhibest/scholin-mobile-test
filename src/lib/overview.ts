import { supabase } from './supabase';

// School overview data. Mirrors school-overview.html: the heavy analysis runs in the database
// (get_* functions), and this file only asks for it and shapes it for the screen.

export type OverviewCtx = { schoolId: string; userId: string; isAdmin: boolean; canSeeFees: boolean };
export type Item = { icon: string; priority: 'critical' | 'high' | 'moderate' | 'low'; title: string; detail: string; action: string; why: string; type: string; detailData: any };
export type Trend = { label: string; delta: number };

export const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3 };
export const money = (v: any) => '₦' + Number(v || 0).toLocaleString();

export function ymd(d: Date) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export async function fetchSessionOptions(schoolId: string) {
  const { data } = await supabase.from('sessions').select('id, name, is_current').eq('school_id', schoolId).order('created_at', { ascending: false });
  return (data || []) as { id: string; name: string; is_current: boolean }[];
}

export async function fetchTermOptions(sessionId: string) {
  const { data } = await supabase.from('terms').select('id, name, is_current').eq('session_id', sessionId).order('created_at', { ascending: true });
  return (data || []) as { id: string; name: string; is_current: boolean }[];
}

// Reads every row, a page at a time, so a big school is never silently cut off at 1000 rows.
async function fetchAllRows(build: (from: number, to: number) => any) {
  const rows: any[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error || !data) {
      break;
    }
    rows.push(...data);
    if (data.length < 1000) {
      break;
    }
  }
  return rows;
}

export type OverviewData = {
  studentCount: number;
  staffCount: number;
  attendanceRate: number;
  classes: { id: string; name: string }[];
  gradeBands: { grade: string; count: number; pct: number }[];
  activity: { title: string; detail: string | null; created_at: string }[];
  gender: { male: number; female: number; unspecified: number } | null;
  punctuality: { data: any; staffLate: any[] } | null;
  finance: { expected: number; collected: number; outstanding: number; rate: number | null } | null;
  academic: { health: any; movers: any; patterns: any } | null;
  attendanceIntel: { thisWeek: any; prevWeek: any; today: any; repeated: any[]; consecutive: any[] } | null;
  register: any;
  assessment: any;
  enrollment: any;
  health: { overall: number; statusLabel: string; tier: 'green' | 'yellow' | 'red'; explainer: string } | null;
  needsAttention: Item[];
  positiveProgress: string[];
  trends: Trend[];
  insights: any[];
  dataQuality: any;
  myAttendance: { present: number; late: number } | null;
};

export async function loadOverview(ctx: OverviewCtx, sessionId: string | null, termId: string | null): Promise<OverviewData> {
  const { schoolId, userId, isAdmin, canSeeFees } = ctx;

  // Identical database calls made during one load are only sent once.
  const memo = new Map<string, Promise<any>>();
  const rpc = (name: string, args: Record<string, any>): Promise<any> => {
    const key = name + JSON.stringify(args);
    if (!memo.has(key)) {
      memo.set(
        key,
        Promise.resolve(supabase.rpc(name, args))
          .then((r: any) => (r && !r.error ? r.data : null))
          .catch(() => null),
      );
    }
    return memo.get(key)!;
  };

  const today = new Date();
  const weekStart = addDays(today, -6);
  const prevWeekEnd = addDays(weekStart, -1);
  const prevWeekStart = addDays(prevWeekEnd, -6);
  const monthStart = addDays(today, -29);
  const prevMonthEnd = addDays(monthStart, -1);
  const prevMonthStart = addDays(prevMonthEnd, -29);

  const [studentsRes, scaleRes, staffRes, classesRes] = await Promise.all([
    supabase.from('students').select('id, gender').eq('school_id', schoolId),
    supabase.from('grading_scale').select('*').eq('school_id', schoolId),
    supabase.from('school_members').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true),
    supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
  ]);
  const students = (studentsRes.data || []) as any[];
  const scale = ((scaleRes.data || []) as any[]).slice().sort((a, b) => b.min_score - a.min_score);
  const classes = ((classesRes.data || []) as any[]).map(c => ({ id: c.id, name: c.name }));

  const att = (s: Date, e: Date, classId: string | null = null) =>
    rpc('get_attendance_health', { p_school_id: schoolId, p_class_id: classId, p_start_date: ymd(s), p_end_date: ymd(e) });
  const repeatedAbs = () => rpc('get_repeated_absences', { p_school_id: schoolId, p_class_id: null, p_start_date: ymd(weekStart), p_end_date: ymd(today), p_threshold: 3 });
  const academicHealth = () => (termId ? rpc('get_academic_health', { p_school_id: schoolId, p_term_id: termId, p_class_id: null }) : Promise.resolve(null));
  const movers = () => (termId ? rpc('get_academic_movers', { p_school_id: schoolId, p_term_id: termId }) : Promise.resolve(null));
  const registerHealth = () => (termId ? rpc('get_register_health', { p_school_id: schoolId, p_term_id: termId, p_class_id: null }) : Promise.resolve(null));
  const feeHealth = () => rpc('get_fee_health', { p_school_id: schoolId });
  const punct = (s: Date, e: Date) => rpc('get_staff_punctuality_health', { p_school_id: schoolId, p_start_date: ymd(s), p_end_date: ymd(e) });
  const staffLate = () => rpc('get_staff_repeated_lateness', { p_school_id: schoolId, p_start_date: ymd(monthStart), p_end_date: ymd(today), p_threshold: 3 });

  // ---- Grade distribution (from the same data as Academic Intelligence) ----
  const moversData = await movers();
  let gradeBands: OverviewData['gradeBands'] = [];
  if (students.length && scale.length && termId && moversData && moversData.has_data) {
    const counts: Record<string, number> = {};
    scale.forEach(g => (counts[g.grade] = 0));
    (moversData.students || []).forEach((s: any) => {
      const band = scale.find(g => s.overall_pct >= g.min_score && s.overall_pct <= g.max_score);
      if (band) {
        counts[band.grade] = (counts[band.grade] || 0) + 1;
      }
    });
    const graded = Object.values(counts).reduce((a, b) => a + b, 0);
    gradeBands = scale.map(g => ({ grade: g.grade, count: counts[g.grade] || 0, pct: graded > 0 ? Math.round(((counts[g.grade] || 0) / graded) * 100) : 0 }));
  }

  // ---- Overall attendance rate for the term (whole school) ----
  let attendanceRate = 0;
  if (termId && classes.length) {
    const ids = classes.map(c => c.id);
    const marks = await fetchAllRows((from, to) => supabase.from('daily_attendance_marks').select('status').in('class_id', ids).eq('term_id', termId).range(from, to));
    if (marks.length) {
      attendanceRate = Math.round((marks.filter(m => m.status === 'present').length / marks.length) * 100);
    }
  }

  const { data: activityRows } = await supabase.from('activity_log').select('title, detail, created_at').eq('school_id', schoolId).order('created_at', { ascending: false }).limit(5);

  // ---- Admin only blocks ----
  let gender: OverviewData['gender'] = null;
  let punctuality: OverviewData['punctuality'] = null;
  let finance: OverviewData['finance'] = null;
  let academic: OverviewData['academic'] = null;
  let attendanceIntel: OverviewData['attendanceIntel'] = null;
  let register: any = null;
  let assessment: any = null;
  let enrollment: any = null;
  let health: OverviewData['health'] = null;
  let myAttendance: OverviewData['myAttendance'] = null;
  let insights: any[] = [];
  let dataQuality: any = null;

  if (isAdmin) {
    const [pData, lateList, fee, ah, patterns, thisWeek, prevWeek, todayH, repeated, consecutive, reg, comp, enr] = await Promise.all([
      punct(monthStart, today),
      staffLate(),
      canSeeFees ? feeHealth() : Promise.resolve(null),
      academicHealth(),
      termId ? rpc('get_subject_patterns', { p_school_id: schoolId, p_term_id: termId }) : Promise.resolve(null),
      att(weekStart, today),
      att(prevWeekStart, prevWeekEnd),
      att(today, today),
      repeatedAbs(),
      rpc('get_consecutive_absences', { p_school_id: schoolId, p_class_id: null, p_min_streak: 2 }),
      registerHealth(),
      termId && sessionId ? rpc('get_assessment_completion', { p_school_id: schoolId, p_term_id: termId, p_session_id: sessionId }) : Promise.resolve(null),
      sessionId ? rpc('get_enrollment_health', { p_school_id: schoolId, p_session_id: sessionId }) : Promise.resolve(null),
    ]);

    let male = 0;
    let female = 0;
    let unspecified = 0;
    students.forEach(s => {
      const g = (s.gender || '').toLowerCase();
      if (g === 'male') {
        male++;
      } else if (g === 'female') {
        female++;
      } else {
        unspecified++;
      }
    });
    gender = { male, female, unspecified };
    punctuality = { data: pData, staffLate: lateList || [] };
    if (canSeeFees) {
      finance = fee && fee.has_data ? { expected: Number(fee.expected), collected: Number(fee.collected), outstanding: Number(fee.outstanding), rate: fee.rate } : { expected: 0, collected: 0, outstanding: 0, rate: null };
    }
    academic = { health: ah, movers: moversData, patterns };
    attendanceIntel = { thisWeek, prevWeek, today: todayH, repeated: repeated || [], consecutive: consecutive || [] };
    register = reg;
    assessment = comp;
    enrollment = enr;

    // School health score: the average of whichever parts have real data.
    const academicAvg = students.length && termId && ah && ah.has_data ? Math.round(ah.overall_avg) : null;
    const teacherScore = pData && pData.has_data ? Math.round(pData.rate) : null;
    const parts = [attendanceRate, academicAvg, teacherScore, finance ? finance.rate : null].filter(v => v !== null && v !== undefined) as number[];
    const labels = ['Attendance', 'Academic', 'Teachers', 'Finance'];
    const values = [attendanceRate, academicAvg, teacherScore, finance ? finance.rate : null];
    if (parts.length) {
      const overall = Math.round(parts.reduce((s, v) => s + v, 0) / parts.length);
      const tier = overall >= 80 ? 'green' : overall >= 60 ? 'yellow' : 'red';
      const statusLabel = overall >= 80 ? 'Good' : overall >= 60 ? 'Stable' : overall >= 40 ? 'Needs Attention' : 'Critical';
      let weakest = '';
      let low = Infinity;
      values.forEach((v, i) => {
        if (v !== null && v !== undefined && (v as number) < low) {
          low = v as number;
          weakest = labels[i].toLowerCase();
        }
      });
      const explainer =
        overall >= 80
          ? 'Your school is performing well overall. Keep up the good work and focus on ' + weakest + ' to stay ahead.'
          : overall >= 60
          ? 'Overall performance is stable, but ' + weakest + ' currently needs attention.'
          : 'Several areas need attention, especially ' + weakest + '. Review the sections below.';
      health = { overall, statusLabel, tier, explainer };
    }
  } else {
    const { data: records } = await supabase.from('staff_attendance').select('clock_in_status').eq('school_id', schoolId).eq('user_id', userId);
    const list = (records || []) as any[];
    myAttendance = { present: list.length, late: list.filter(r => r.clock_in_status === 'late').length };
  }

  // ---- Needs attention, positive progress and trends ----
  const needsAttention: Item[] = [];
  const positiveProgress: string[] = [];
  const trends: Trend[] = [];

  const [repeatedAbsences, thisWeekAtt, prevWeekAtt] = await Promise.all([repeatedAbs().then(r => r || []), att(weekStart, today), att(prevWeekStart, prevWeekEnd)]);
  if (repeatedAbsences.length > 0) {
    needsAttention.push({
      icon: 'info',
      priority: repeatedAbsences.length >= 8 ? 'high' : 'moderate',
      title: 'Repeated Absence (Students)',
      detail: repeatedAbsences.length + ' student' + (repeatedAbsences.length === 1 ? '' : 's') + ' have been absent 3+ times this week.',
      action: 'Contact parents/guardians.',
      why:
        'A student is flagged here after 3 or more absences within the last 7 days. ' +
        repeatedAbsences.slice(0, 3).map((s: any) => s.name).join(', ') +
        (repeatedAbsences.length > 3 ? ', and others' : '') +
        ' triggered this.',
      type: 'attendance_repeated_absence',
      detailData: repeatedAbsences,
    });
  }
  if (thisWeekAtt && thisWeekAtt.has_data && prevWeekAtt && prevWeekAtt.has_data) {
    const delta = thisWeekAtt.rate - prevWeekAtt.rate;
    trends.push({ label: 'Student Attendance', delta });
    if (delta > 0.5) {
      positiveProgress.push('Overall attendance improved by ' + delta.toFixed(1) + '% this week.');
    }
  }
  if (termId) {
    const academicNow = await academicHealth();
    if (academicNow && academicNow.has_data) {
      const weakest = (academicNow.subjects || []).slice().sort((a: any, b: any) => a.avg_score - b.avg_score)[0];
      if (weakest && weakest.avg_score < 60) {
        needsAttention.push({
          icon: 'trend',
          priority: weakest.avg_score < 50 ? 'high' : 'moderate',
          title: 'Low ' + weakest.name + ' Performance',
          detail: 'School average is ' + weakest.avg_score + '% across ' + weakest.student_count + ' students.',
          action: 'Review and plan remedial support.',
          why: weakest.name + ' is currently the lowest performing subject this term, below the 60% comfort threshold.',
          type: 'academic_low_subject',
          detailData: weakest,
        });
      }
      if (academicNow.prev_term_avg !== null && academicNow.prev_term_avg !== undefined) {
        const delta = academicNow.overall_avg - academicNow.prev_term_avg;
        trends.push({ label: 'Academic Performance', delta });
        if (delta > 0.5) {
          positiveProgress.push('Overall academic performance improved by ' + delta.toFixed(1) + '% compared to last term.');
        }
      }
    }
    const reg = await registerHealth();
    if (reg && reg.has_data && (reg.classes_not_recorded_recently > 0 || reg.completion_rate < 90)) {
      needsAttention.push({
        icon: 'clipboard',
        priority: reg.completion_rate < 75 ? 'high' : 'moderate',
        title: 'Incomplete Registers',
        detail: reg.classes_not_recorded_recently + ' class' + (reg.classes_not_recorded_recently === 1 ? '' : 'es') + ' not recorded recently, ' + reg.completion_rate + '% completion overall.',
        action: 'Ask teachers to review and complete records.',
        why: 'Register completion for this term is ' + reg.completion_rate + '%, out of ' + reg.expected_total + ' expected class days.',
        type: 'register_incomplete',
        detailData: reg,
      });
    }
  }
  if (isAdmin) {
    const [fee, thisWeekFees, prevWeekFees, late, thisMonth, prevMonth] = await Promise.all([
      canSeeFees ? feeHealth() : Promise.resolve(null),
      canSeeFees ? rpc('get_fee_collected_in_period', { p_school_id: schoolId, p_start_date: ymd(weekStart), p_end_date: ymd(today) }).then(v => Number(v || 0)) : Promise.resolve(0),
      canSeeFees ? rpc('get_fee_collected_in_period', { p_school_id: schoolId, p_start_date: ymd(prevWeekStart), p_end_date: ymd(prevWeekEnd) }).then(v => Number(v || 0)) : Promise.resolve(0),
      staffLate().then(r => r || []),
      punct(monthStart, today),
      punct(prevMonthStart, prevMonthEnd),
    ]);
    if (fee && fee.has_data && fee.rate < 90) {
      needsAttention.push({
        icon: 'wallet',
        priority: fee.rate < 60 ? 'high' : 'moderate',
        title: 'Outstanding Fees',
        detail: money(fee.outstanding) + ' outstanding (' + (90 - fee.rate).toFixed(1) + '% below a 90% target).',
        action: 'Follow up with affected accounts.',
        why: money(fee.collected) + ' collected out of ' + money(fee.expected) + ' expected so far.',
        type: 'finance_outstanding_fees',
        detailData: fee,
      });
    }
    if (prevWeekFees > 0) {
      const pct = ((thisWeekFees - prevWeekFees) / prevWeekFees) * 100;
      trends.push({ label: 'Fee Collection', delta: pct });
      if (pct > 0.5) {
        positiveProgress.push('Fee collection improved by ' + pct.toFixed(1) + '% compared to last week.');
      }
    }
    if (late.length > 0) {
      needsAttention.push({
        icon: 'clock',
        priority: 'moderate',
        title: 'Staff Late Clock ins',
        detail: late.length + ' staff member' + (late.length === 1 ? '' : 's') + ' have been late 3+ times this month.',
        action: 'Review individual records privately.',
        why: late.slice(0, 3).map((s: any) => s.name).join(', ') + (late.length > 3 ? ', and others' : '') + ' recorded repeated late clock ins.',
        type: 'staff_late_clockins',
        detailData: late,
      });
    }
    if (thisMonth && thisMonth.has_data && prevMonth && prevMonth.has_data) {
      const delta = thisMonth.rate - prevMonth.rate;
      trends.push({ label: 'Staff Punctuality', delta });
      if (delta > 0.5) {
        positiveProgress.push('Staff punctuality improved by ' + delta.toFixed(1) + '% this month.');
      }
    }
    // Keep the saved issue history in step, then read it back.
    try {
      await supabase.rpc('sync_school_insights', { p_school_id: schoolId, p_term_id: termId });
    } catch {
      // The history tables may not exist yet. The rest of the overview still works.
    }
    const [ins, dq] = await Promise.all([rpc('get_school_insights', { p_school_id: schoolId, p_status: null }), termId ? rpc('get_data_quality', { p_school_id: schoolId, p_term_id: termId }) : Promise.resolve(null)]);
    insights = ins || [];
    dataQuality = dq;
  }
  needsAttention.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  return {
    studentCount: students.length,
    staffCount: staffRes.count || 0,
    attendanceRate,
    classes,
    gradeBands,
    activity: (activityRows || []) as any[],
    gender,
    punctuality,
    finance,
    academic,
    attendanceIntel,
    register,
    assessment,
    enrollment,
    health,
    needsAttention,
    positiveProgress,
    trends,
    insights,
    dataQuality,
    myAttendance,
  };
}

// ---- Attendance chart (filterable by class and time window) ----

function mondayOf(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return ymd(d);
}

export async function fetchAttendanceBars(
  classes: { id: string; name: string }[],
  classFilter: string,
  period: 'week' | 'month' | 'term' | 'session',
  termId: string | null,
  sessionTerms: { id: string; name: string }[],
) {
  const classIds = classFilter === 'all' ? classes.map(c => c.id) : [classFilter];
  const termIds = period === 'session' ? sessionTerms.map(t => t.id) : termId ? [termId] : [];
  if (!classIds.length || !termIds.length) {
    return [] as { label: string; rate: number }[];
  }
  const marks = await fetchAllRows((from, to) => supabase.from('daily_attendance_marks').select('mark_date, status, term_id').in('class_id', classIds).in('term_id', termIds).range(from, to));
  if (!marks.length) {
    return [];
  }
  const buckets: Record<string, { present: number; total: number; label: string }> = {};
  const bump = (key: string, m: any, label = '') => {
    if (!buckets[key]) {
      buckets[key] = { present: 0, total: 0, label };
    }
    buckets[key].total++;
    if (m.status === 'present') {
      buckets[key].present++;
    }
  };
  if (period === 'week') {
    const dates = Array.from(new Set(marks.map(m => m.mark_date as string))).sort().slice(-7);
    dates.forEach(d => (buckets[d] = { present: 0, total: 0, label: new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' }) }));
    marks.forEach(m => {
      if (buckets[m.mark_date]) {
        bump(m.mark_date, m);
      }
    });
  } else if (period === 'month') {
    const prefix = ymd(new Date()).slice(0, 7);
    marks.filter(m => String(m.mark_date).slice(0, 7) === prefix).forEach(m => bump(mondayOf(m.mark_date), m));
    Object.keys(buckets).sort().forEach((k, i) => (buckets[k].label = 'Week ' + (i + 1)));
  } else if (period === 'term') {
    marks.forEach(m => bump(mondayOf(m.mark_date), m));
    Object.keys(buckets).sort().forEach((k, i) => (buckets[k].label = 'Wk ' + (i + 1)));
  } else {
    const names: Record<string, string> = {};
    sessionTerms.forEach(t => (names[t.id] = t.name));
    marks.forEach(m => bump(m.term_id, m, names[m.term_id] || 'Term'));
  }
  return Object.values(buckets)
    .filter(b => b.total > 0)
    .map(b => ({ label: b.label, rate: Math.round((b.present / b.total) * 100) }));
}
