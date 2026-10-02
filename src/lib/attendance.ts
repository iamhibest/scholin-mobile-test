import { supabase } from './supabase';
import { toISODateLocal } from './format';

export type Mode = 'combined' | 'separate';
export type Marks = Record<string, Record<string, string>>;

export function weekStartOf(dateStr?: string) {
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return toISODateLocal(d);
}

export function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toISODateLocal(d);
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dayParts(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return { weekday: DAYS[d.getDay()], day: d.getDate(), month: MONTHS[d.getMonth()] };
}

export function longDay(dateStr: string) {
  const p = dayParts(dateStr);
  return p.weekday + ', ' + p.day + ' ' + p.month;
}

export async function fetchAttendanceMode(schoolId: string): Promise<Mode> {
  const { data } = await supabase.from('schools').select('attendance_mode').eq('id', schoolId).single();
  return data && data.attendance_mode === 'separate' ? 'separate' : 'combined';
}

export async function fetchDaysOpen(classId: string, termId: string, weekStart: string) {
  const { data } = await supabase
    .from('weekly_attendance_config')
    .select('days_open')
    .eq('class_id', classId)
    .eq('term_id', termId)
    .eq('week_start_date', weekStart)
    .maybeSingle();
  return data ? (data.days_open as number) : 5;
}

export async function saveDaysOpen(classId: string, termId: string, weekStart: string, days: number, userId: string) {
  const { error } = await supabase
    .from('weekly_attendance_config')
    .upsert({ class_id: classId, term_id: termId, week_start_date: weekStart, days_open: days, created_by: userId }, { onConflict: 'class_id,term_id,week_start_date' });
  if (error) {
    throw new Error(error.message || 'Could not save.');
  }
}

export async function fetchDayMarks(classId: string, date: string): Promise<Marks> {
  const { data, error } = await supabase.from('daily_attendance_marks').select('student_id, session, status').eq('class_id', classId).eq('mark_date', date);
  if (error) {
    throw new Error(error.message || 'Could not load the register.');
  }
  const marks: Marks = {};
  (data || []).forEach((m: any) => {
    if (!marks[m.student_id]) {
      marks[m.student_id] = {};
    }
    marks[m.student_id][m.session] = m.status;
  });
  return marks;
}

export function buildRows(roster: { id: string }[], marks: Marks, mode: Mode, classId: string, termId: string, date: string, userId: string) {
  const sessions = mode === 'separate' ? ['morning', 'afternoon'] : ['combined'];
  const rows: any[] = [];
  roster.forEach(s => {
    const m = marks[s.id] || {};
    sessions.forEach(session => {
      if (m[session]) {
        rows.push({ student_id: s.id, class_id: classId, term_id: termId, mark_date: date, session, status: m[session], marked_by: userId });
      }
    });
  });
  return rows;
}

export function lagosToday() {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function fetchTodayRecord(schoolId: string, userId: string) {
  const { data } = await supabase.from('staff_attendance').select('*').eq('school_id', schoolId).eq('user_id', userId).eq('date', lagosToday()).maybeSingle();
  return data;
}

export function timeLabel(iso?: string | null) {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + (m < 10 ? '0' + m : m) + ' ' + suffix;
}

export function hoursLabel(h?: number | null) {
  if (h === null || h === undefined) {
    return '';
  }
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return hrs + 'h ' + mins + 'm';
}

export function parseQr(value: string) {
  if (typeof value !== 'string' || !value.startsWith('SCHOLIN-ATTEND:')) {
    return null;
  }
  const parts = value.split(':');
  if (parts.length !== 4 || !parts[1] || !parts[2] || !parts[3]) {
    return null;
  }
  return { schoolId: parts[1], pointId: parts[2], token: parts[3] };
}

export async function submitClock(body: any): Promise<any> {
  const { data, error } = await supabase.functions.invoke('record-attendance', { body });
  if (error) {
    let message = 'Attendance could not be verified.';
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        const parsed = await ctx.json();
        if (parsed && parsed.error) {
          message = parsed.error;
        }
      }
    } catch {}
    throw new Error(message);
  }
  if (!data || data.error) {
    throw new Error((data && data.error) || 'Attendance could not be verified.');
  }
  return data;
}

export function computeDayValue(marks: Record<string, string>, mode: Mode) {
  if (mode === 'separate') {
    const m = marks.morning;
    const a = marks.afternoon;
    if (!m && !a) {
      return null;
    }
    let value = 0;
    if (m === 'present') {
      value += 1;
    }
    if (a === 'present') {
      value += 1;
    }
    return value;
  }
  if (!marks.combined) {
    return null;
  }
  return marks.combined === 'present' ? 2 : 0;
}
