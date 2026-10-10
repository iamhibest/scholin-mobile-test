import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ChildWish, fetchChildBirthdayWishes } from './birthdayWishes';

// The parent's children celebrating today. The server works out "today" in Nigerian time,
// so the wish appears from 12:00am on the birthday and is gone from 12:00am the next day.
export function useChildBirthdayWishes(enabled: boolean) {
  const [wishes, setWishes] = useState<ChildWish[]>([]);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!enabled) {
      return;
    }
    try {
      const w = await fetchChildBirthdayWishes();
      if (alive.current) {
        setWishes(w);
      }
    } catch {
      // No banner is better than a broken one.
    }
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        reload();
      }
    });
    return () => sub.remove();
  }, [reload]);

  // Check again just after midnight Nigerian time.
  useEffect(() => {
    let timer: any;
    const arm = () => {
      const lagos = new Date(Date.now() + 60 * 60 * 1000);
      const msLeft = ((24 - lagos.getUTCHours()) * 3600 - lagos.getUTCMinutes() * 60 - lagos.getUTCSeconds()) * 1000 - lagos.getUTCMilliseconds();
      timer = setTimeout(() => {
        reload();
        arm();
      }, msLeft + 2000);
    };
    arm();
    return () => clearTimeout(timer);
  }, [reload]);

  return { wishes, reload };
}
