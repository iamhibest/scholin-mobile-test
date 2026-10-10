import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { fetchBirthdayRows, summarizeBirthdays } from './birthdays';
import { lagosToday } from './attendance';

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Loading birthdays took too long.')), ms);
    p.then(
      v => {
        clearTimeout(t);
        resolve(v);
      },
      e => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

// Birthdays for the dashboard banner. It never gets stuck loading (it times out and retries by itself),
// and it works out "today" and "tomorrow" again at 12:00am Nigerian time, so the reminder appears
// the moment the day changes, even if the app has been left open overnight.
export function useBirthdays(schoolId?: string) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [todayKey, setTodayKey] = useState(lagosToday());
  const tries = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!schoolId) {
      return;
    }
    try {
      const r = await withTimeout(fetchBirthdayRows(schoolId), 12000);
      if (!alive.current) {
        return;
      }
      tries.current = 0;
      setRows(r);
      setError('');
    } catch (e: any) {
      if (!alive.current) {
        return;
      }
      setError(e && e.message ? e.message : 'Could not load birthdays.');
      if (tries.current < 3) {
        tries.current += 1;
        setTimeout(() => {
          if (alive.current) {
            reload();
          }
        }, 2500 * tries.current);
      }
    }
  }, [schoolId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Coming back to the app: refresh the list and the date.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setTodayKey(lagosToday());
        reload();
      }
    });
    return () => sub.remove();
  }, [reload]);

  // Change over at 12:00am Nigerian time (UTC+1).
  useEffect(() => {
    let timer: any;
    const arm = () => {
      const lagos = new Date(Date.now() + 60 * 60 * 1000);
      const msLeft = ((24 - lagos.getUTCHours()) * 3600 - lagos.getUTCMinutes() * 60 - lagos.getUTCSeconds()) * 1000 - lagos.getUTCMilliseconds();
      timer = setTimeout(() => {
        setTodayKey(lagosToday());
        reload();
        arm();
      }, msLeft + 1500);
    };
    arm();
    return () => clearTimeout(timer);
  }, [reload]);

  const summary = useMemo(() => (rows ? summarizeBirthdays(rows, todayKey) : null), [rows, todayKey]);
  return { summary, error, reload, todayKey };
}
