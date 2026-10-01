import { useEffect, useState } from 'react';
import { loadStaffContext, StaffContext } from './school';

export function useStaff() {
  const [ctx, setCtx] = useState<StaffContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    loadStaffContext()
      .then(c => {
        if (alive) {
          setCtx(c);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  return { ctx, loading };
}
