import { supabase } from './supabase';
import { addDays, lagosToday } from './attendance';
import { logger } from './logger';

// Student birthdays for a school. Dates use Nigerian time, like the rest of the app.
export type Birthday = { id: string; name: string; photo: string | null; month: number; day: number; turning: number; dateLabel: string };
export type BirthdaySummary = {
  today: Birthday[];
  tomorrow: Birthday[];
  upcoming: Birthday[]; // later this month
  earlier: Birthday[]; // already celebrated this month
  nextMonth: Birthday[];
  soon: Birthday[]; // next upcoming day, only if within a week
  remaining: number; // today and the rest of this month
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const cache: Record<string, { at: number; rows: any[] }> = {};

// Always asks for the current list, so a student added a minute ago is counted at once.
// The last good list is only used if the internet fails.
export async function fetchBirthdayRows(schoolId: string, _force = false) {
  const rows: any[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabase.from('students').select('id, full_name, dob, photo_url').eq('school_id', schoolId).not('dob', 'is', null).range(from, from + 999);
    if (error || !data) {
      logger.error('Birthdays could not load: ' + (error ? error.message : 'no data'));
      const kept = cache[schoolId];
      return kept ? kept.rows : rows;
    }
    rows.push(...data);
    if (data.length < 1000) {
      break;
    }
  }
  cache[schoolId] = { at: Date.now(), rows };
  return rows;
}

function leap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function summarizeBirthdays(rows: any[], todayStr = lagosToday()): BirthdaySummary {
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const [, tomM, tomD] = addDays(todayStr, 1).split('-').map(Number);
  const nextM = tm === 12 ? 1 : tm + 1;
  const out: BirthdaySummary = { today: [], tomorrow: [], upcoming: [], earlier: [], nextMonth: [], soon: [], remaining: 0 };

  for (const r of rows) {
    const parts = String(r.dob || '').slice(0, 10).split('-').map(Number);
    if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
      continue;
    }
    const [by, m, dRaw] = parts;
    // A 29 February birthday is marked on the 28th in years without one.
    const d = m === 2 && dRaw === 29 && !leap(ty) ? 28 : dRaw;
    const year = m < tm || (m === tm && d < td) ? ty + 1 : ty;
    const b: Birthday = { id: r.id, name: r.full_name || 'Student', photo: r.photo_url || null, month: m, day: d, turning: Math.max(0, year - by), dateLabel: MONTHS[m - 1] + ' ' + d };

    if (m === tm && d === td) {
      out.today.push(b);
    }
    if (m === tomM && d === tomD) {
      out.tomorrow.push(b);
    }
    if (m === tm) {
      if (d > td) {
        out.upcoming.push(b);
      } else if (d < td) {
        out.earlier.push(b);
      }
    } else if (m === nextM) {
      out.nextMonth.push(b);
    }
  }
  const byDay = (a: Birthday, b: Birthday) => a.day - b.day || a.name.localeCompare(b.name);
  out.today.sort(byDay);
  out.tomorrow.sort(byDay);
  out.upcoming.sort(byDay);
  out.earlier.sort(byDay);
  out.nextMonth.sort(byDay);
  const nextDay = out.upcoming.length ? out.upcoming[0].day : 0;
  if (nextDay && nextDay - td <= 7) {
    out.soon = out.upcoming.filter(b => b.day === nextDay);
  }
  out.remaining = out.today.length + out.upcoming.length;
  return out;
}

export function namesText(list: Birthday[]) {
  const names = list.map(b => b.name);
  if (names.length <= 2) {
    return names.join(' and ');
  }
  return names.slice(0, 2).join(', ') + ' and ' + (names.length - 2) + (names.length - 2 === 1 ? ' other' : ' others');
}
